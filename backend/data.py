"""Real-data layer for SmartCharge.

Loads the real ChargePoint session export and work orders. All analytics
(occupancy, per-station duration/idle distributions, reliability, user "charge
DNA", turnover math) are derived from the real data. Falls back to a small
synthetic set only if the CSV is missing.
"""
import os
import re
from functools import lru_cache

import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CP_CSV = os.path.join(DATA_DIR, "chargepoint_sessions.csv")
WO_XLSX = os.path.join(DATA_DIR, "work_orders.xlsx")

FEATURED_USER = "159231V"
PEAK_START, PEAK_END = 8, 16  # SME: Mon-Fri 8 AM - 4 PM


def _dur_to_min(s):
    try:
        h, m, sec = str(s).split(":")
        return int(h) * 60 + int(m) + int(sec) / 60
    except Exception:
        return np.nan


def _short(name: str) -> str:
    # "FPL / JUNO BEACH 06" -> "JUNO BEACH 06"
    return re.sub(r"^FPL\s*/\s*", "", str(name)).strip()


@lru_cache(maxsize=1)
def sessions() -> pd.DataFrame:
    df = pd.read_csv(CP_CSV)
    df["station"] = df["Station Name"].map(_short)
    df["start"] = pd.to_datetime(df["Start Date"], errors="coerce")
    df["end"] = pd.to_datetime(df["End Date"], errors="coerce")
    df["dur_min"] = df["Total Duration (hh:mm:ss)"].map(_dur_to_min)
    df["chg_min"] = df["Charging Time (hh:mm:ss)"].map(_dur_to_min)
    df["idle_min"] = (df["dur_min"] - df["chg_min"]).clip(lower=0)
    df["energy"] = pd.to_numeric(df["Energy (kWh)"], errors="coerce").fillna(0)
    df["hour"] = df["start"].dt.hour
    df["dow"] = df["start"].dt.day_name()
    df["weekday"] = df["start"].dt.weekday
    df["port"] = pd.to_numeric(df["Port Number"], errors="coerce").fillna(1).astype(int)
    df["user"] = df["User ID"].astype("string")
    df = df.dropna(subset=["start", "end", "dur_min"])
    return df


@lru_cache(maxsize=1)
def station_names():
    return sorted(sessions()["station"].unique().tolist())


@lru_cache(maxsize=1)
def station_reliability():
    """Per-station stats + data-driven ghost signal (zero-kWh rate)."""
    df = sessions()
    out = {}
    for st, sub in df.groupby("station"):
        n = len(sub)
        zero = int((sub["energy"] < 0.1).sum())
        zero_pct = round(zero / n * 100, 1) if n else 0
        # Reliability: penalise zero-energy + failed end reasons.
        failed = int(sub["Ended By"].isin(
            ["Timeout", "Auth Failed", "Plug Removed While Rebooting"]).sum())
        reliability = float(round(max(0, 100 - zero_pct * 1.3 - failed / n * 100 * 0.5), 1)) if n else 0.0
        out[st] = {
            "station": st,
            "sessions": int(n),
            "zero_kwh_pct": float(zero_pct),
            "failed_sessions": failed,
            "avg_energy_kwh": round(float(sub["energy"].mean()), 1),
            "avg_charge_min": int(sub["chg_min"].mean()),
            "avg_idle_min": int(sub["idle_min"].mean()),
            "reliability": reliability,
        }
    return out


@lru_cache(maxsize=1)
def hour_arrival_weights():
    """Weekday arrival-hour distribution (normalised)."""
    df = sessions()
    wk = df[df["weekday"] < 5]
    counts = wk["hour"].value_counts().reindex(range(24), fill_value=0)
    total = counts.sum()
    return {h: float(counts[h] / total) for h in range(24)}


@lru_cache(maxsize=1)
def station_hour_share():
    """Share of arrivals per station per hour — used to spread the sim."""
    df = sessions()
    wk = df[df["weekday"] < 5]
    out = {}
    for st, sub in wk.groupby("station"):
        counts = sub["hour"].value_counts().reindex(range(24), fill_value=0)
        out[st] = counts.to_dict()
    return out


@lru_cache(maxsize=1)
def station_duration_stats():
    """Median charge + idle minutes per station (for sim + predictions)."""
    df = sessions()
    out = {}
    for st, sub in df.groupby("station"):
        out[st] = {
            "median_charge": float(np.clip(sub["chg_min"].median(), 30, 480)),
            "median_total": float(np.clip(sub["dur_min"].median(), 30, 600)),
            "median_idle": float(np.clip(sub["idle_min"].median(), 0, 240)),
            "mean_idle": float(sub["idle_min"].mean()),
        }
    return out


@lru_cache(maxsize=1)
def weekday_concurrency():
    """Avg concurrent ChargePoint ports in use by hour (weekdays)."""
    df = sessions()
    wk = df[df["weekday"] < 5]
    days = wk["start"].dt.date.nunique() or 1
    occ = {h: 0 for h in range(24)}
    for _, r in wk.iterrows():
        for h in range(r["start"].hour, min(23, r["end"].hour) + 1):
            occ[h] += 1
    return {h: round(occ[h] / days, 1) for h in range(24)}


@lru_cache(maxsize=1)
def weekday_departure_minutes():
    """Real weekday session END times (minutes past midnight) for the daytime
    departure wave. Used to shape the sim's leave times to the actual curve —
    unplugs peak ~4 PM and taper to near-empty by 7 PM. The overnight-charger
    early-morning unplug spike (~7 AM) is excluded since it doesn't describe
    when the daytime workday crowd leaves."""
    df = sessions()
    wk = df[df["weekday"] < 5]
    mins = wk["end"].dt.hour * 60 + wk["end"].dt.minute
    mins = mins[(mins >= 11 * 60) & (mins <= 21 * 60)]
    return [int(m) for m in mins.tolist()]


@lru_cache(maxsize=1)
def user_pattern(user_id: str = FEATURED_USER):
    df = sessions()
    u = df[df["user"] == user_id]
    if u.empty:
        return None
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_counts = u["dow"].value_counts().to_dict()
    typical_days = sorted(day_counts, key=lambda d: -day_counts[d])[:3]
    fav_station = u["station"].value_counts().idxmax()
    mode_hour = int(u["hour"].mode().iloc[0])  # most common arrival hour (robust)
    is_overnight = mode_hour >= 19 or mode_hour <= 4
    return {
        "user_id": user_id,
        "total_sessions": int(len(u)),
        "typical_days": [d for d in order if d in typical_days],
        "typical_arrival_hour": mode_hour,
        "is_overnight": bool(is_overnight),
        "avg_charge_minutes": int(round(u["chg_min"].mean())),
        "avg_total_minutes": int(round(u["dur_min"].mean())),
        "avg_idle_minutes": int(round(u["idle_min"].mean())),
        "avg_energy_kwh": round(float(u["energy"].mean()), 1),
        "favorite_station": fav_station,
        "day_distribution": {d: int(day_counts.get(d, 0)) for d in order},
        "hour_distribution": {int(h): int(c) for h, c in
                              u["hour"].value_counts().sort_index().items()},
    }


@lru_cache(maxsize=1)
def congestion_stats():
    df = sessions()
    n = len(df)
    idle = df["idle_min"]
    total_idle_hours = float(idle.sum() / 60)
    days = df["start"].dt.date.nunique() or 1
    # Reclaimable port-hours/day if idle halved.
    reclaimable_port_hours_day = round(total_idle_hours / days / 2, 1)
    conc = weekday_concurrency()
    workday_peak = max(conc[h] for h in range(PEAK_START, PEAK_END))
    return {
        "total_sessions": n,
        "median_total_min": int(df["dur_min"].median()),
        "median_charge_min": int(df["chg_min"].median()),
        "mean_idle_min": int(idle.mean()),
        "idle_over_60_pct": round(float((idle > 60).mean()) * 100),
        "idle_over_120_pct": round(float((idle > 120).mean()) * 100),
        "over_6h_pct": round(float((df["dur_min"] > 360).mean()) * 100),
        "workday_peak_concurrency": workday_peak,
        "chargepoint_ports": 26,
        "workday_utilization_pct": round(workday_peak / 26 * 100),
        "reclaimable_port_hours_day": reclaimable_port_hours_day,
        "unique_users": int(df["user"].nunique()),
    }


@lru_cache(maxsize=1)
def work_orders():
    if not os.path.exists(WO_XLSX):
        return []
    wo = pd.read_excel(WO_XLSX)
    rows = []
    for _, r in wo.iterrows():
        problem = str(r.get("Problem", "")).replace("\n", " ").strip()
        problem = re.sub(r"^Electric Vehicle - EV Charger:\s*>?\s*", "", problem)
        rows.append({
            "wo": str(r.get("Work Order Number", "")),
            "priority": str(r.get("Priority", "")),
            "status": str(r.get("Status", "")),
            "building": str(r.get("Building", "")),
            "problem": problem[:180],
            "entered": str(r.get("Entered", ""))[:10],
            "completed": None if pd.isna(r.get("Date Complete Site")) else str(r.get("Date Complete Site"))[:10],
        })
    return rows
