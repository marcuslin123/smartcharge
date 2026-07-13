"""Simulated real-time engine.

Generates one canonical simulated weekday of per-port sessions from the real
historical distributions, then answers "what is every port doing at simulated
minute T?". Check-in / check-out and the handoff queue mutate live in-memory
state that takes precedence over the generated schedule. A live feed can later
replace `_generate_schedule` with real telemetry without touching the API.
"""
import random
from functools import lru_cache

from data import station_duration_stats, station_hour_share, weekday_departure_minutes
from inventory import operational_ports, ports_by_id

DAY_START = 6 * 60
DAY_END = 19 * 60
SEED = 20260616


def _fmt(minute: float) -> str:
    minute = int(round(minute))
    h, m = (minute // 60) % 24, minute % 60
    suffix = "AM" if h < 12 else "PM"
    hh = h % 12 or 12
    return f"{hh}:{m:02d} {suffix}"


@lru_cache(maxsize=1)
def _schedule():
    """port_id -> list of sessions {start, charge_end, leave, user, energy_ok}.

    Departures are sampled from the REAL weekday end-time distribution so the
    live curve matches history: ports stay packed 8 AM-3 PM, then unplugs peak
    ~4 PM and taper to near-empty by 7 PM. A port that frees before mid-afternoon
    is refilled (turnover) so middays stay full, but the final session of the day
    leaves on the real evening curve rather than camping until close.
    """
    rng = random.Random(SEED)
    dur = station_duration_stats()
    share = station_hour_share()
    departures = weekday_departure_minutes() or [16 * 60]
    sched = {}

    for p in operational_ports():
        st = p["station"]
        d = dur.get(st, {"median_charge": 300, "mean_idle": 90})
        # Morning arrival concentrated 6-9 AM (real data: 7 AM spike).
        hours = list(range(6, 10))
        weights = [share.get(st, {}).get(h, 1) + 0.5 for h in hours]
        first_h = rng.choices(hours, weights=weights, k=1)[0]
        t = first_h * 60 + rng.randint(0, 59)
        # A few ports start late -> a little extra early-morning availability.
        if rng.random() < 0.12:
            t = rng.randint(8 * 60, 11 * 60)

        sessions = []
        for _ in range(6):  # a port turns over at most a handful of times/day
            # Draw a real departure time; must sit a sensible minimum after arrival.
            min_leave = t + max(45, min(d["median_charge"], 180))
            leave = None
            for _try in range(8):
                cand = rng.choice(departures) + rng.randint(-20, 20)
                if cand >= min_leave:
                    leave = cand
                    break
            if leave is None:
                # No sampled departure lands after arrival (late arrival) -> a
                # short top-up that ends on the evening taper.
                leave = min(min_leave, DAY_END + rng.randint(0, 60))
            leave = min(leave, DAY_END + 90)

            charge = max(30, rng.gauss(d["median_charge"], 45))
            charge_end = min(t + charge, leave)
            sessions.append({
                "start": round(t),
                "charge_end": round(charge_end),
                "leave": round(leave),
                "user": f"{rng.randint(100000, 999999)}V",
                "energy_ok": rng.random() > 0.06,
            })

            # Only refill if the port frees early enough to matter (keeps middays
            # full); a later-afternoon departure ends the port's day.
            if leave >= 15 * 60 or rng.random() < 0.35:
                break
            t = leave + max(0, rng.gauss(12, 10))
        sched[p["id"]] = sessions
    return sched


class Sim:
    INCOMING_TTL = 15  # minutes a "heading here" marker lingers before auto-clearing

    def __init__(self):
        # port_id -> override dict
        self.overrides = {}
        self.queue = []          # list of {user, joined, cluster, id}
        self.assignments = {}    # user -> {port, at}
        self.recent_recs = {}    # port_id -> minute last recommended (smart spread)
        self._qid = 0

    # ---- smart spread (non-locking) ----------------------------------------
    def note_recommendation(self, port_id, t):
        """Record that a port was just recommended so future requests can prefer
        a different one when supply allows. Not a hold — walk-ups always win."""
        self.recent_recs[port_id] = t

    def rec_staleness(self, port_id, t):
        """Minutes since this port was last recommended.  Higher = more stale =
        prefer when breaking ties."""
        last = self.recent_recs.get(port_id)
        if last is None:
            return 9999
        return max(0, t - last)

    # ---- live state -------------------------------------------------------
    def port_state(self, port_id, t):
        p = ports_by_id()[port_id]
        if p["is_offline"]:
            return {"id": port_id, "status": "offline", "reason": p["offline_reason"],
                    "source": p["offline_source"]}

        ov = self.overrides.get(port_id)
        if ov:
            if ov["kind"] == "incoming":
                # A driver said they're heading here. Visibility only — the port
                # is still physically free (a walk-up wins, FCFS). Auto-expires.
                if t - ov["at"] > self.INCOMING_TTL:
                    return {"id": port_id, "status": "available"}
                return {"id": port_id, "status": "incoming", "user": ov["user"],
                        "planned_minutes": ov["charge_minutes"], "since": t - ov["at"]}
            if ov["kind"] == "you":
                if t < ov["charge_end"]:
                    return {"id": port_id, "status": "charging_you",
                            "predicted_free": ov["leave"], "predicted_full": ov["charge_end"],
                            "free_in": max(0, ov["leave"] - t), "user": "you"}
                if t < ov["leave"]:
                    return {"id": port_id, "status": "idle_you",
                            "predicted_free": ov["leave"], "over_by": t - ov["charge_end"],
                            "free_in": max(0, ov["leave"] - t), "user": "you"}
                # your session naturally ended
                return {"id": port_id, "status": "available"}
            if ov["kind"] == "occupied":
                if t >= ov["leave"]:
                    return {"id": port_id, "status": "available"}
                return self._sched_state(port_id, ov, t)
            if ov["kind"] == "freed" and t >= ov["at"]:
                # forced free until a later generated session begins
                nxt = self._next_session_after(port_id, ov["at"])
                if nxt and t >= nxt["start"]:
                    return self._sched_state(port_id, nxt, t)
                return {"id": port_id, "status": "available"}

        cur = self._session_at(port_id, t)
        if cur is None:
            return {"id": port_id, "status": "available"}
        return self._sched_state(port_id, cur, t)

    def _sched_state(self, port_id, s, t):
        if t < s["charge_end"]:
            status = "charging"
        elif t < s["leave"]:
            status = "idle_done"
        else:
            return {"id": port_id, "status": "available"}
        out = {
            "id": port_id, "status": status,
            "predicted_free": s["leave"], "predicted_full": s["charge_end"],
            "free_in": max(0, s["leave"] - t),
            "energy_ok": s["energy_ok"],
        }
        if status == "idle_done":
            out["over_by"] = t - s["charge_end"]
        return out

    def _session_at(self, port_id, t):
        for s in _schedule().get(port_id, []):
            if s["start"] <= t < s["leave"]:
                return s
        return None

    def _next_session_after(self, port_id, t):
        for s in _schedule().get(port_id, []):
            if s["start"] >= t:
                return s
        return None

    # ---- snapshot ---------------------------------------------------------
    def snapshot(self, t, viewer="you"):
        self._expire_assignments(t)
        states = [self.port_state(p["id"], t) for p in ports_by_id().values()]
        by_id = {s["id"]: s for s in states}
        merged = []
        for p in ports_by_id().values():
            m = {**p, **by_id[p["id"]]}
            merged.append(m)
        avail = [m for m in merged if m["status"] == "available"]
        incoming = [m for m in merged if m["status"] == "incoming"]
        charging = [m for m in merged if m["status"] in ("charging", "charging_you")]
        idle = [m for m in merged if m["status"] in ("idle_done", "idle_you")]
        offline = [m for m in merged if m["status"] == "offline"]
        # next few free-ups
        upcoming = sorted(
            [{"id": m["id"], "at": m["predicted_free"]}
             for m in merged if m.get("predicted_free") and m["status"] not in ("available", "incoming", "offline")],
            key=lambda x: x["at"])[:5]
        # "incoming" ports are still physically open (FCFS), so they count as open.
        open_ids = [m["id"] for m in avail] + [m["id"] for m in incoming]
        return {
            "minute": t,
            "time": _fmt(t),
            "ports": merged,
            "counts": {
                "available": len(avail) + len(incoming),
                "incoming": len(incoming),
                "charging": len(charging),
                "idle_done": len(idle),
                "offline": len(offline),
                "total": len(merged),
                "operational": len(merged) - len(offline),
            },
            "available_ids": open_ids,
            "idle_ids": [m["id"] for m in idle],
            "upcoming_free": [{"id": u["id"], "time": _fmt(u["at"]), "in_min": max(0, u["at"] - t)} for u in upcoming],
            "queue_length": len(self.queue),
        }

    def free_by(self, t, target):
        """How many ports are/will be free by `target` minute."""
        cnt = 0
        for p in ports_by_id().values():
            s = self.port_state(p["id"], t)
            if s["status"] == "available":
                cnt += 1
            elif s.get("predicted_free") and s["predicted_free"] <= target:
                cnt += 1
        return cnt

    # ---- actions ----------------------------------------------------------
    def check_in(self, port_id, t, charge_minutes, user="you"):
        """'On my way' — mark a port as *heading here* for visibility, NOT in-use.
        The driver hasn't plugged in yet, so the port stays physically open and a
        walk-up who plugs in first still wins (FCFS). Auto-clears after 15 min.
        The actual session only begins on start_charging()."""
        p = ports_by_id().get(port_id)
        if not p or p["is_offline"]:
            return {"ok": False, "error": "Port unavailable"}
        st = self.port_state(port_id, t)
        if st["status"] not in ("available", "incoming"):
            return {"ok": False, "error": "just_taken",
                    "message": f"{port_id} is already in use — someone got there first (FCFS). Try another port."}
        self.overrides[port_id] = {
            "kind": "incoming", "at": t, "charge_minutes": charge_minutes, "user": user,
        }
        self.assignments.pop(user, None)
        return {"ok": True, "port": port_id, "status": "incoming",
                "clears_by": _fmt(t + self.INCOMING_TTL)}

    def start_charging(self, port_id, t, charge_minutes, user="you"):
        """'I've plugged in' — the driver is physically at the charger. Only now
        does the port become an actual (yours) session with a finish time."""
        p = ports_by_id().get(port_id)
        if not p or p["is_offline"]:
            return {"ok": False, "error": "Port unavailable"}
        st = self.port_state(port_id, t)
        # You can start if it's open or if it's your own 'heading here' marker.
        taken_by_other = st["status"] not in ("available", "incoming") or (
            st["status"] == "incoming" and st.get("user") != user)
        if taken_by_other:
            return {"ok": False, "error": "just_taken",
                    "message": f"{port_id} is already in use — someone got there first (FCFS). Try another port."}
        self.overrides[port_id] = {
            "kind": "you", "start": t,
            "charge_end": t + charge_minutes, "leave": 24 * 60,
            "user": user,
        }
        self.assignments.pop(user, None)
        return {"ok": True, "port": port_id, "checkout_by": _fmt(t + charge_minutes),
                "full_minute": t + charge_minutes}

    def demo_occupy(self, port_id, t, minutes=120):
        """Demo: a colleague physically takes the port."""
        p = ports_by_id().get(port_id)
        if not p or p["is_offline"]:
            return {"ok": False, "error": "Port unavailable"}
        self.overrides[port_id] = {
            "kind": "occupied", "start": t,
            "charge_end": t + minutes, "leave": t + minutes + 60,
            "energy_ok": True, "user": "colleague",
        }
        return {"ok": True, "port": port_id}

    def check_out(self, port_id, t):
        ov = self.overrides.get(port_id)
        self.overrides[port_id] = {"kind": "freed", "at": t}
        handoff = self._assign_next(port_id, t)
        return {"ok": True, "port": port_id, "handoff": handoff,
                "freed_early_min": max(0, ov["leave"] - t) if ov and ov.get("leave") else 0}

    def join_queue(self, user, cluster=None, t=0):
        for q in self.queue:
            if q["user"] == user:
                return {"ok": True, "position": self.queue.index(q) + 1, "already": True}
        self._qid += 1
        self.queue.append({"user": user, "joined": t, "cluster": cluster, "id": self._qid})
        return {"ok": True, "position": len(self.queue)}

    def leave_queue(self, user):
        self.queue = [q for q in self.queue if q["user"] != user]
        return {"ok": True}

    def _assign_next(self, port_id, t):
        """Notify the next person in the handoff line that a port freed.
        This is informational — not a reservation. FCFS at the physical charger."""
        if not self.queue:
            return None
        nxt = self.queue.pop(0)
        self.assignments[nxt["user"]] = {"port": port_id, "at": t}
        return {"user": nxt["user"], "port": port_id, "at": _fmt(t)}

    def _expire_assignments(self, t):
        """Clear stale handoff notifications after 15 min so they don't pile up."""
        for user, a in list(self.assignments.items()):
            if t - a["at"] > 15:
                self.assignments.pop(user, None)

    def looking_count(self, t):
        """People actively looking to charge right now: those in the handoff line
        plus anyone who flagged a port as 'planning to use / watching'."""
        watchers = sum(1 for p in ports_by_id()
                       if self.port_state(p, t)["status"] == "incoming")
        return len(self.queue) + watchers

    def queue_status(self, user=None, t=None):
        if t is not None:
            self._expire_assignments(t)
        out = {"length": len(self.queue),
               "queue": [{"position": i + 1, "user": q["user"]} for i, q in enumerate(self.queue)]}
        if user:
            pos = next((i + 1 for i, q in enumerate(self.queue) if q["user"] == user), None)
            out["your_position"] = pos
            out["your_assignment"] = self.assignments.get(user)
        return out

    def reset(self):
        self.overrides.clear()
        self.queue.clear()
        self.assignments.clear()
        self.recent_recs.clear()


SIM = Sim()
