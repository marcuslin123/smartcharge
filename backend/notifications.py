"""Live, segmented notifications derived from the real-time snapshot."""
from data import congestion_stats
from sim import SIM, _fmt


def notifications(t: int):
    snap = SIM.snapshot(t)
    cs = congestion_stats()
    out = []

    looking = SIM.looking_count(t)
    looking_txt = (f" {looking} colleague{'s are' if looking != 1 else ' is'} looking to charge right now."
                   if looking > 0 else "")

    # Move-your-car nudge (the biggest congestion lever).
    idle = [p for p in snap["ports"] if p["status"] in ("idle_done", "idle_you")]
    if idle:
        worst = max(idle, key=lambda p: p.get("over_by", 0))
        out.append({
            "id": "move-car", "icon": "alert-triangle", "priority": "high",
            "segment": "idle_campers",
            "title": f"{len(idle)} full cars still plugged in",
            "body": (f"{worst['id']} has been done for ~{int(worst.get('over_by', 0))} min. "
                     "If you've got enough charge to get home, please move your vehicle now so "
                     "someone else can plug in." + looking_txt),
        })

    # Watching / planning-to-use visibility.
    watching = [p for p in snap["ports"] if p["status"] == "incoming"]
    if watching:
        out.append({
            "id": "watching", "icon": "users", "priority": "normal", "segment": "waiting",
            "title": f"{len(watching)} port(s) being watched",
            "body": ("Colleagues have flagged these as 'planning to use' — a visibility signal, "
                     "not a reservation. They're still open; first to plug in wins (FCFS)."),
        })

    # Handoff status.
    if snap["queue_length"] > 0:
        out.append({
            "id": "handoff", "icon": "clock", "priority": "normal", "segment": "waiting",
            "title": f"{snap['queue_length']} in the handoff line",
            "body": "When a charger frees, the next person in line is pinged automatically. "
                    "No reservations, no circling — fair first-come, first-served.",
        })

    # Next free-up.
    if snap["upcoming_free"]:
        nf = snap["upcoming_free"][0]
        out.append({
            "id": "next-free", "icon": "zap", "priority": "low", "segment": "all",
            "title": f"Next charger frees ~{nf['time']}",
            "body": f"{nf['id']} should open in about {nf['in_min']} min based on that "
                    "driver's typical session.",
        })

    # Ghost / reliability.
    offline = [p for p in snap["ports"] if p["status"] == "offline"]
    if offline:
        out.append({
            "id": "ghost", "icon": "ghost", "priority": "high", "segment": "all",
            "title": f"{len(offline)} ports offline — excluded",
            "body": "; ".join(f"{p['id']} ({p['offline_reason']})" for p in offline),
        })

    # Morning turnover insight.
    out.append({
        "id": "turnover", "icon": "trending-up", "priority": "normal", "segment": "all",
        "title": "Turnover beats timing",
        "body": (f"ChargePoint ports run ~{cs['workday_utilization_pct']}% full 8 AM–4 PM. "
                 f"Cars idle a mean {cs['mean_idle_min']} min after charging — reclaiming half "
                 f"of that frees ~{cs['reclaimable_port_hours_day']} port-hours a day."),
    })
    return out
