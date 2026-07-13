"""SmartCharge v2 FastAPI backend — real data + simulated real-time engine."""
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import data
from inventory import ports, clusters, TOTAL_CAMPUS_PORTS
from notifications import notifications
from recommend import recommend
from sim import SIM

app = FastAPI(title="SmartCharge v2 API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"], allow_credentials=True)


class MeetingBlock(BaseModel):
    start: float = Field(ge=0, le=24)
    end: float = Field(ge=0, le=24)


class RecommendReq(BaseModel):
    battery_pct: float = Field(35, ge=0, le=100)
    commute_miles: float = Field(24, ge=1, le=80)
    has_home_charger: bool = True
    current_minute: int = Field(9 * 60, ge=0, le=1439)
    cluster: Optional[str] = None
    user: str = "you"
    calendar_blocks: list[MeetingBlock] = []


class CheckInReq(BaseModel):
    port_id: str
    current_minute: int
    charge_minutes: int = Field(90, ge=15, le=480)
    user: str = "you"


class CheckOutReq(BaseModel):
    port_id: str
    current_minute: int


class QueueReq(BaseModel):
    user: str = "you"
    cluster: Optional[str] = None
    current_minute: int = 0


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/live")
def live(minute: int = 9 * 60, viewer: str = "you"):
    return SIM.snapshot(max(0, min(1439, minute)), viewer=viewer)


@app.post("/api/checkin")
def checkin(req: CheckInReq):
    """'On my way' — mark the port as heading-here (visibility, not a reservation)."""
    r = SIM.check_in(req.port_id, req.current_minute, req.charge_minutes, req.user)
    if not r["ok"]:
        raise HTTPException(status_code=409,
                            detail={"error": r["error"], "message": r.get("message", r["error"])})
    return r


@app.post("/api/start-charging")
def start_charging(req: CheckInReq):
    """'I've plugged in' — begin the actual session (physically at the charger)."""
    r = SIM.start_charging(req.port_id, req.current_minute, req.charge_minutes, req.user)
    if not r["ok"]:
        raise HTTPException(status_code=409,
                            detail={"error": r["error"], "message": r.get("message", r["error"])})
    return r


@app.post("/api/checkout")
def checkout(req: CheckOutReq):
    return SIM.check_out(req.port_id, req.current_minute)


@app.post("/api/queue/join")
def queue_join(req: QueueReq):
    return SIM.join_queue(req.user, req.cluster, req.current_minute)


@app.post("/api/queue/leave")
def queue_leave(req: QueueReq):
    return SIM.leave_queue(req.user)


@app.get("/api/queue/status")
def queue_status(user: str = "you", minute: Optional[int] = None):
    return SIM.queue_status(user, t=minute)


@app.post("/api/recommend")
def api_recommend(req: RecommendReq):
    blocks = [{"start": b.start, "end": b.end} for b in req.calendar_blocks]
    return recommend(req.battery_pct, req.commute_miles, req.has_home_charger,
                     req.current_minute, req.cluster, req.user, blocks)


@app.get("/api/notifications")
def api_notifications(minute: int = 9 * 60):
    return notifications(max(0, min(1439, minute)))


@app.get("/api/chargers")
def chargers():
    return {"ports": ports(), "clusters": clusters(),
            "reliability": data.station_reliability()}


@app.get("/api/work-orders")
def work_orders():
    return {"work_orders": data.work_orders()}


@app.get("/api/stats")
def stats():
    cs = data.congestion_stats()
    cs["total_campus_ports"] = TOTAL_CAMPUS_PORTS
    cs["program_enrollees"] = 656
    return cs


@app.get("/api/insights")
def insights():
    return {
        "congestion": data.congestion_stats(),
        "reliability": list(data.station_reliability().values()),
        "concurrency_by_hour": data.weekday_concurrency(),
        "arrival_by_hour": {int(h): round(w * 100, 1) for h, w in data.hour_arrival_weights().items()},
    }


@app.get("/api/user/{user_id}/pattern")
def user_pattern(user_id: str):
    p = data.user_pattern(user_id)
    if p is None:
        raise HTTPException(status_code=404, detail="User not found")
    return p


class StealReq(BaseModel):
    port_id: str
    current_minute: int


@app.post("/api/demo/steal")
def demo_steal(req: StealReq):
    """Demo control: a colleague physically grabs a port (e.g. the one you were
    just recommended), to illustrate FCFS at the physical charger."""
    return SIM.demo_occupy(req.port_id, req.current_minute)


class SimulateReq(BaseModel):
    count: int = Field(10, ge=1, le=26)
    battery_pct: float = Field(20, ge=0, le=100)
    commute_miles: float = Field(40, ge=1, le=80)
    has_home_charger: bool = False
    current_minute: int = Field(9 * 60, ge=0, le=1439)


@app.post("/api/demo/simulate")
def demo_simulate(req: SimulateReq):
    """Demo control: N colleagues with identical battery/schedule all request at
    once. Shows the smart spread giving DIFFERENT ports while supply lasts, then
    (when there are more drivers than open ports) honestly pointing the overflow
    at the same ports — first to physically plug in wins (FCFS)."""
    SIM.recent_recs.clear()  # clean, deterministic spread for the demo
    snap = SIM.snapshot(req.current_minute)
    open_ports = snap["counts"]["available"]
    order = []
    groups = {}   # port_id -> [rank...] (nth requester pointed here)
    for i in range(req.count):
        user = f"sim{i + 1}"
        r = recommend(req.battery_pct, req.commute_miles, req.has_home_charger,
                      req.current_minute, None, user)
        if r.get("mode") == "charge_now":
            pid = r["port"]["id"]
            order.append({"user": user, "rank": i + 1, "port": pid,
                          "station": r["port"]["station"]})
            groups.setdefault(pid, []).append(i + 1)
        else:
            order.append({"user": user, "rank": i + 1, "port": None, "mode": r.get("mode")})
    ports = [{"port": pid, "first": min(ranks), "shared_by": len(ranks)}
             for pid, ranks in groups.items()]
    ports.sort(key=lambda x: x["first"])
    return {
        "count": req.count,
        "open_ports": open_ports,
        "distinct_ports": len(groups),
        "unique_first": min(req.count, open_ports),
        "ports": ports,
        "order": order,
    }


@app.post("/api/demo/reset_sims")
def demo_reset_sims():
    """Clear only the simulated colleagues (queue + recs), leaving your session."""
    SIM.queue = [q for q in SIM.queue if not str(q["user"]).startswith("sim")]
    SIM.assignments = {u: a for u, a in SIM.assignments.items() if not str(u).startswith("sim")}
    SIM.recent_recs.clear()
    return {"ok": True}


@app.post("/api/reset")
def reset():
    SIM.reset()
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
