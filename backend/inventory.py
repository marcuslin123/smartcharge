"""Charger inventory derived from the real ChargePoint data.

13 stations x 2 ports = 26 real ChargePoint ports, grouped into the two
GPS-confirmed clusters (Beach lot vs Parking garage). Offline ports and
reliability come from the data (zero-kWh rate) corroborated by work orders.
The wider 106-port campus (other brands) is summarised separately as simulated.
"""
import re
from functools import lru_cache

from data import station_names, station_reliability

TOTAL_CAMPUS_PORTS = 106  # SME confirmed (all brands)

# Data-driven ghost: JUNO BEACH 06 has ~53% zero-kWh sessions -> one plug dead.
GHOST_PORTS = {
    ("JUNO BEACH 06", "B"): {
        "reason": "53% zero-kWh sessions (data) + work order: 'one plug not charging'",
        "source": "data",
    },
    ("JUNO GARAGE 03", "B"): {
        "reason": "Work order C1138806: 'ChargePoint 3 not sending power'",
        "source": "work_order",
    },
}


def _cluster_of(station: str):
    if "GARAGE" in station:
        return ("garage", "Main Parking Garage")
    return ("beach", "Building E Lot (Outside)")


def _num(station: str) -> int:
    m = re.search(r"(\d+)$", station)
    return int(m.group(1)) if m else 0


@lru_cache(maxsize=1)
def ports():
    rel = station_reliability()
    out = []
    for st in station_names():
        cluster, location = _cluster_of(st)
        n = _num(st)
        code = ("B" if cluster == "beach" else "G")
        r = rel.get(st, {})
        for letter in ("A", "B"):
            key = (st, letter)
            ghost = GHOST_PORTS.get(key)
            out.append({
                "id": f"{code}{n:02d}-{letter}",       # e.g. B06-A  (A1-style)
                "station": st,
                "port_letter": letter,
                "cluster": cluster,
                "location": location,
                "reliability": r.get("reliability", 100),
                "avg_charge_min": r.get("avg_charge_min", 240),
                "is_offline": bool(ghost),
                "offline_reason": ghost["reason"] if ghost else None,
                "offline_source": ghost["source"] if ghost else None,
            })
    return out


@lru_cache(maxsize=1)
def ports_by_id():
    return {p["id"]: p for p in ports()}


def operational_ports():
    return [p for p in ports() if not p["is_offline"]]


def clusters():
    return [
        {"key": "beach", "name": "Building E Lot (Outside)"},
        {"key": "garage", "name": "Main Parking Garage"},
    ]
