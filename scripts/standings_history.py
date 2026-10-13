"""Incrementally cache Jolpica's official per-round championship standings.

Historic points MUST originate from the standings endpoint, not be guessed
from individual race and Sprint points (penalties and amendments exist).
"""
from __future__ import annotations
import json
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "standings-history"


def parse_standings(payload, kind):
    """Return compact official rows, or None for an unavailable/invalid page."""
    if kind not in ("driver", "constructor"):
        raise ValueError("unsupported standings kind")
    if not isinstance(payload, dict):
        return None
    md = payload.get("MRData")
    if not isinstance(md, dict):
        return None
    table = md.get("StandingsTable")
    if not isinstance(table, dict):
        return None
    lists = table.get("StandingsLists")
    if not isinstance(lists, list):
        return None
    if not lists:
        return None
    field = "DriverStandings" if kind == "driver" else "ConstructorStandings"
    rows = lists[0].get(field) if isinstance(lists[0], dict) else None
    if not isinstance(rows, list) or not rows:
        return None
    data = []
    for row in rows:
        subject = row.get("Driver") if kind == "driver" else row.get("Constructor")
        key = "driverId" if kind == "driver" else "constructorId"
        identifier = subject.get(key) if isinstance(subject, dict) else None
        if not identifier:
            continue
        try:
            pts = float(row["points"])
            rank = int(row["position"])
        except (TypeError, ValueError, KeyError):
            continue
        data.append({"id": identifier, "points": pts, "position": rank})
    return data or None


def load_or_fetch_round(season, rnd, kind, getter, base):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{season}-{rnd}-{kind}.json"
    if path.exists():
        try:
            result = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(result, list) and result:
                return result
        except (OSError, ValueError):
            pass
    route = "driverstandings" if kind == "driver" else "constructorstandings"
    url = f"{base}/{season}/{rnd}/{route}.json?{urlencode({'limit': 100})}"
    data = parse_standings(getter(url, optional=True), kind)
    if data:
        path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return data


def collect_official_history(season, completed, getter, base):
    """Sparse per-round standings; never insert synthetic values for missing rounds."""
    history = {"driver": {}, "constructor": {}}
    errors = []
    for race in sorted(completed, key=lambda x: int(x["round"])):
        rnd = str(race["round"])
        for kind in ("driver", "constructor"):
            try:
                data = load_or_fetch_round(season, rnd, kind, getter, base)
            except (OSError, ValueError, TypeError) as exc:
                data = None
                errors.append(f"{rnd}/{kind}: {exc}")
            if data:
                history[kind][rnd] = data
            else:
                errors.append(f"{rnd}/{kind}: unavailable")
    return history, errors
