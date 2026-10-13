"""Build cached, non-live race-analysis snapshots from OpenF1's free historical API.

Position is sampled at an approximate lap-completion timestamp. These snapshots
MUST NOT be presented as official lap classification or live timing.
"""
import json
import shutil
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "race-analysis"
PUBLIC = ROOT / "public" / "data" / "analysis"
OPENF1 = "https://api.openf1.org/v1"


def as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def as_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def sample_lap_positions(position_rows, lap_rows, parse_date):
    """Approximate positions at one common timestamp near each lap's first finish.

    Missing samples are OMITTED, not guessed. This is not an official lap table.
    """
    by_driver = defaultdict(list)
    for row in position_rows:
        no, pos = as_int(row.get("driver_number")), as_int(row.get("position"))
        stamp = parse_date(row.get("date"))
        if no is not None and pos is not None and pos > 0 and stamp:
            by_driver[no].append((stamp.timestamp(), pos))
    for samples in by_driver.values():
        samples.sort()

    lap_finish = defaultdict(list)
    for row in lap_rows:
        lap = as_int(row.get("lap_number"))
        start = parse_date(row.get("date_start"))
        duration = as_float(row.get("lap_duration"))
        if lap is not None and 1 <= lap <= 90 and start and duration and 0 < duration < 600:
            lap_finish[lap].append(start.timestamp() + duration)

    snapshots = []
    pointers = {driver: 0 for driver in by_driver}
    last_known = {}
    for lap in sorted(lap_finish):
        # Earliest recorded finish approximates the leader completing this lap.
        boundary = min(lap_finish[lap])
        positions = []
        for driver, samples in by_driver.items():
            index = pointers[driver]
            while index < len(samples) and samples[index][0] <= boundary:
                last_known[driver] = samples[index][1]
                index += 1
            pointers[driver] = index
            if driver in last_known:
                positions.append({"number": driver, "position": last_known[driver]})
        if positions:
            positions.sort(key=lambda item: (item["position"], item["number"]))
            snapshots.append({"lap": lap, "positions": positions})
    return snapshots


def normalize_lap_times(rows):
    """Compact documented OpenF1 lap timings. Missing and invalid laps stay absent.

    This includes timings run under flags or changing track conditions; no
    unsupported classification as clean/green-flag racing is inferred.
    """
    normalized = {}
    for item in rows:
        if not isinstance(item, dict):
            continue
        no, lap = as_int(item.get("driver_number")), as_int(item.get("lap_number"))
        duration = as_float(item.get("lap_duration"))
        if no is None or lap is None or lap < 1 or lap > 250:
            continue
        if duration is None or not 30 <= duration <= 600:
            continue
        sectors = []
        for field in ("duration_sector_1", "duration_sector_2", "duration_sector_3"):
            value = as_float(item.get(field))
            sectors.append(round(value, 3) if value is not None and 0 < value < 300 else None)
        record = {
            "number": no, "lap": lap, "time": round(duration, 3),
            "sectors": sectors,
            "pitOut": item.get("is_pit_out_lap") is True,
        }
        key = (no, lap)
        previous = normalized.get(key)
        if previous is None or sum(x is not None for x in record["sectors"]) > sum(
            x is not None for x in previous["sectors"]
        ):
            normalized[key] = record
    return sorted(normalized.values(), key=lambda x: (x["lap"], x["number"]))


def normalize_stints(rows):
    result = []
    for row in rows:
        no = as_int(row.get("driver_number"))
        start, end = as_int(row.get("lap_start")), as_int(row.get("lap_end"))
        if no is None or start is None or start < 1:
            continue
        result.append({
            "number": no, "lapStart": start, "lapEnd": end,
            "compound": str(row.get("compound") or "UNKNOWN").upper(),
            "tyreAgeStart": as_int(row.get("tyre_age_at_start")),
        })
    return sorted(result, key=lambda x: (x["number"], x["lapStart"]))


def normalize_pits(rows):
    result = []
    for row in rows:
        no, lap = as_int(row.get("driver_number")), as_int(row.get("lap_number"))
        if no is None or lap is None:
            continue
        result.append({
            "number": no, "lap": lap,
            "stopDuration": as_float(row.get("stop_duration")),
            "laneDuration": as_float(row.get("lane_duration")),
        })
    return sorted(result, key=lambda x: (x["lap"], x["number"]))


def build_race_analysis(year, race, session, results, get_json, parse_date):
    key = session.get("session_key")
    if not key:
        return None

    def fetch(endpoint):
        rows = get_json(f"{OPENF1}/{endpoint}?{urlencode({'session_key': key})}", optional=True)
        return rows if isinstance(rows, list) else None

    # Position and laps are essential for replay; tyre and pit data may be absent.
    position_rows, lap_rows = fetch("position"), fetch("laps")
    stints, pits = fetch("stints"), fetch("pit")
    if position_rows is None and lap_rows is None and stints is None and pits is None:
        return None
    snapshots = sample_lap_positions(position_rows or [], lap_rows or [], parse_date)
    drivers = []
    for row in results:
        driver = row.get("Driver") or {}
        team = row.get("Constructor") or {}
        no = as_int(driver.get("permanentNumber"))
        if no is not None:
            drivers.append({
                "number": no,
                "code": driver.get("code") or driver.get("familyName", "")[:3].upper(),
                "name": (driver.get("givenName", "") + " " + driver.get("familyName", "")).strip(),
                "team": team.get("name") or "—",
                "teamId": team.get("constructorId"),
            })
    return {
        "season": year, "round": str(race["round"]), "sessionKey": key,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sampling": "approximate-lap-finish",
        "drivers": drivers, "lapSnapshots": snapshots,
        "lapTimes": normalize_lap_times(lap_rows or []), "schemaVersion": 2,
        "stints": normalize_stints(stints or []), "pitStops": normalize_pits(pits or []),
        "sources": {"positions": position_rows is not None, "laps": lap_rows is not None,
                    "lapTimes": lap_rows is not None,
                    "stints": stints is not None, "pit": pits is not None},
    }


def refresh_analyses(year, completed, sessions, results, match_session,
                     get_json, parse_date, max_new=4, max_enrich=2):
    """Progressively backfill completed rounds; reuse cache on each scheduled build."""
    CACHE.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    available = []
    pending = []
    upgrade = []
    for race in reversed(completed):  # newest first
        rnd = str(race["round"])
        path = CACHE / f"{year}-{rnd}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if data.get("season") == year and data.get("round") == rnd:
                    # Older v1.4 analysis snapshots already contain raw position
                    # sampling but did not persist lap duration. Enrich from one
                    # historical laps request without rebuilding everything.
                    if "lapTimes" not in data:
                        upgrade.append((race, data, path))
                    shutil.copyfile(path, PUBLIC / path.name)
                    available.append(rnd)
                    continue
            except (OSError, ValueError):
                pass
        pending.append(race)

    attempts = 0
    for race in pending:
        if attempts >= max_new:
            break
        session = match_session(race, sessions)
        if not session:
            continue
        attempts += 1
        rnd = str(race["round"])
        try:
            data = build_race_analysis(year, race, session, results.get(rnd, []),
                                       get_json, parse_date)
            if data and any(data.get(x) for x in ("lapSnapshots", "stints", "pitStops")):
                path = CACHE / f"{year}-{rnd}.json"
                path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
                shutil.copyfile(path, PUBLIC / path.name)
                available.append(rnd)
                print(f"  analysis round {rnd}: {len(data['lapSnapshots'])} lap samples / "
                      f"{len(data['stints'])} stints / {len(data['pitStops'])} pits")
            else:
                print(f"  analysis round {rnd}: source unavailable (retry next build)")
        except (OSError, TypeError, ValueError) as exc:
            print(f"  analysis round {rnd}: skipped {exc}")
    # Maximum two free historical lap requests per build. API failures keep
    # the old usable replay snapshot and will be retried in a later build.
    for race, data, path in upgrade[:max_enrich]:
        rnd = str(race["round"])
        key = data.get("sessionKey")
        if not key:
            continue
        raw = get_json(f"{OPENF1}/laps?{urlencode({'session_key': key})}", optional=True)
        if not isinstance(raw, list):
            print(f"  lap timing round {rnd}: unavailable; preserve original replay")
            continue
        data["lapTimes"] = normalize_lap_times(raw)
        data["schemaVersion"] = 2
        data.setdefault("sources", {})["lapTimes"] = True
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        shutil.copyfile(path, PUBLIC / path.name)
        print(f"  lap timing round {rnd}: backfilled {len(data['lapTimes'])} laps")
    return sorted(set(available), key=int)
