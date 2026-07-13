"""Real-time-aware recommendation engine for v2.

Keeps v1's equitable decision tree (segments, home-charger routing, 5:30 PM
finish, latest-start deadline) but the answer is grounded in *live* availability:
charge now at a specific open port, or join the fair handoff line with a
predicted next free-up — never a fake "off-peak" slot in a saturated garage.
"""
import math

from inventory import ports_by_id
from sim import SIM, _fmt

FULL_RANGE_MILES = 250.0
RESERVE_MILES = 15.0
RATE_MI_PER_MIN = 0.5
MIN_SESSION = 15
END_OF_DAY = 17 * 60 + 30  # 5:30 PM
CONGESTION_TIP = "Unplug when you're done so the next colleague can charge."


def _classify_segment(battery, commute):
    if battery < 30:
        return "high_need"
    if battery >= 30 and commute > 40:
        return "high_need"
    if battery > 60 and commute < 15:
        return "flexible"
    return "standard"


def _rank_available(snapshot, cluster=None, t=0):
    # "incoming" ports (someone said they're heading there) are still physically
    # open under FCFS, so they remain candidates — just deprioritised so we send
    # people to a truly-empty port first when supply allows.
    avail = [m for m in snapshot["ports"] if m["status"] in ("available", "incoming")]
    # When supply > demand the staleness tiebreaker naturally spreads people
    # across different ports.  When demand > supply every port has been recently
    # recommended so the tiebreaker is neutral — multiple people can get the
    # same port, which is correct (FCFS at the physical charger).
    avail.sort(key=lambda m: (0 if (cluster and m["cluster"] == cluster) else 1,
                              1 if m["status"] == "incoming" else 0,
                              -SIM.rec_staleness(m["id"], t),
                              -m["reliability"], m["id"]))
    return avail


def _meeting_note(t, duration, blocks):
    """Tie the driver's meetings to the turnover nudge: if they'll finish charging
    while they're in a meeting, we hold the 'move your car' ping until it ends so
    they don't have to step out — but they still free the port promptly after."""
    if not blocks:
        return None
    full_at = t + duration
    for b in blocks:
        start = int(round(b["start"] * 60))
        end = int(round(b["end"] * 60))
        if end <= t:
            continue
        # A meeting overlapping the moment you'd finish charging.
        if start <= full_at <= end or (start <= t and end >= full_at):
            return (f"You're in a meeting until {_fmt(end)} and you'll be full around "
                    f"{_fmt(full_at)} — plug in now and we'll hold your 'move your car' "
                    f"nudge until {_fmt(end)} so you don't have to step out.")
        # A meeting that starts while you're still charging.
        if t <= start <= full_at:
            return (f"Heads up: your {_fmt(start)} meeting starts before you finish "
                    f"(~{_fmt(full_at)}). Plug in now — we'll nudge you to unplug right "
                    f"after it ends.")
    return None


def recommend(battery_pct, commute_miles, has_home_charger, current_minute,
              cluster=None, user="you", calendar_blocks=None):
    t = int(current_minute)
    calendar_blocks = calendar_blocks or []
    current_range = battery_pct / 100 * FULL_RANGE_MILES
    round_trip = 2 * commute_miles + RESERVE_MILES
    one_way = commute_miles + RESERVE_MILES

    # ---- decision tree ----
    if has_home_charger:
        if battery_pct >= 40 and current_range >= round_trip:
            return _no_charge(True)
        if current_range >= one_way:
            return _home_preferred()
        target = one_way
    else:
        if battery_pct >= 40 and current_range >= round_trip:
            return _no_charge(False)
        target = one_way

    deficit = max(0.0, target - current_range)
    duration = max(MIN_SESSION, int(math.ceil(deficit / RATE_MI_PER_MIN)))
    segment = _classify_segment(battery_pct, commute_miles)
    latest_start = END_OF_DAY - duration

    base = {
        "should_charge": True,
        "user_segment": segment,
        "duration_minutes": duration,
        "has_home_charger": has_home_charger,
        "latest_start_by": _fmt(latest_start),
        "latest_start_minute": latest_start,
        "congestion_tip": CONGESTION_TIP,
    }

    snap = SIM.snapshot(t, viewer=user)

    # past the latest start deadline
    if t > latest_start:
        base.update({
            "mode": "past_deadline", "is_compromise": True,
            "port": None, "backups": [],
            "message": (f"Battery {int(battery_pct)}% — charge now. It's past the latest "
                        f"start to finish by 5:30 PM; grab any open port to stay as little "
                        f"late as possible. " + CONGESTION_TIP),
        })
        return base

    avail = _rank_available(snap, cluster, t)
    if avail:
        primary = avail[0]
        backups = [m for m in avail if m["id"] != primary["id"]][:3]
        # Record for smart spread (not a hold — walk-ups always win).
        SIM.note_recommendation(primary["id"], t)
        # Contention: how many people are looking to charge vs. how many ports are
        # open. When demand strains supply the same port gets recommended to more
        # than one person — we say so honestly (no reservation, FCFS).
        open_now = snap["counts"]["available"]
        looking = SIM.looking_count(t)
        scarce = looking >= open_now or open_now <= 3
        contention_note = None
        if scarce and looking > 0:
            contention_note = (
                f"{looking} other {'person' if looking == 1 else 'people'} also looking.")
        base.update({
            "mode": "charge_now",
            "is_compromise": False,
            "port": {"id": primary["id"], "station": primary["station"],
                     "location": primary["location"], "reliability": primary["reliability"]},
            "backups": [{"id": b["id"], "station": b["station"], "location": b["location"],
                         "reliability": b["reliability"]} for b in backups],
            "meeting_note": _meeting_note(t, duration, calendar_blocks),
            "open_now": open_now,
            "others_looking": looking,
            "scarce": scarce,
            "contention_note": contention_note,
            "message": (f"Battery {int(battery_pct)}% — head to "
                        f"{primary['id']} ({primary['station']}, {primary['location']}). "
                        f"~{duration} min needed. "
                        + ("Charge just enough to get home — your home charger does the rest. "
                           if has_home_charger else "")
                        + f"Finish by {_fmt(t + duration)} (deadline {base['latest_start_by']}). "
                        + CONGESTION_TIP),
        })
        return base

    # nothing open -> honest handoff answer
    nxt = snap["upcoming_free"][0] if snap["upcoming_free"] else None
    by_deadline = SIM.free_by(t, latest_start)
    base.update({
        "mode": "join_line",
        "is_compromise": True,
        "port": None,
        "backups": [],
        "next_free": nxt,
        "queue_length": snap["queue_length"],
        "free_by_deadline": by_deadline,
        "message": (f"Battery {int(battery_pct)}% — every ChargePoint port is busy right now "
                    + (f"(next likely open: {nxt['id']} ~{nxt['time']}). " if nxt else ". ")
                    + f"Join the handoff line and we'll ping you the moment one frees — "
                      f"no circling the lot. {by_deadline} port(s) should free before your "
                      f"{base['latest_start_by']} deadline. " + CONGESTION_TIP),
    })
    return base


def _no_charge(home):
    msg = ("Plug in at home tonight and skip campus charging." if home
           else "No campus top-up needed today — charge at your primary location.")
    return {"should_charge": False, "user_segment": "no_charge_needed", "mode": "no_charge",
            "has_home_charger": home, "duration_minutes": 0, "is_compromise": False,
            "port": None, "backups": [],
            "message": "Save the charger for someone who needs it more! " + msg}


def _home_preferred():
    return {"should_charge": False, "user_segment": "home_charge_preferred", "mode": "home",
            "has_home_charger": True, "duration_minutes": 0, "is_compromise": False,
            "port": None, "backups": [],
            "message": ("Charge at home tonight to top up for tomorrow. You have enough to get "
                        "home — leave the campus chargers for colleagues who need them now.")}
