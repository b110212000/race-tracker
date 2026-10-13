#!/usr/bin/env python3
"""Prepare a public, non-live F1 snapshot for GitHub Pages.

API credits:
- Jolpica-F1 (CC BY-NC-SA 4.0; non-commercial only)
- OpenF1 (historical race-control events only)

No API keys, persistent server, or paid plan are necessary.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from analysis import refresh_analyses
from weekend import get_session_results
from standings_history import collect_official_history

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "season.json"
SEASON = datetime.now(ZoneInfo("Asia/Taipei")).year
JOLPICA = "https://api.jolpi.ca/ergast/f1"
OPENF1 = "https://api.openf1.org/v1"
UA = "RaceTrackerPWA/1.4 (free non-commercial GitHub Pages fan project; API attribution in README)"


def get_json(url: str, *, optional: bool = False):
    """GET with courtesy throttle and retry for transient errors."""
    for attempt in range(3):
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urlopen(req, timeout=30) as r:
                value = json.loads(r.read().decode("utf-8"))
                time.sleep(0.4)
                return value
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            print(f"[WARN] {url}: {exc}", file=sys.stderr)
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
    if optional:
        return None
    raise RuntimeError(f"無法取得必要資料：{url}")


def load_prior():
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def jolpica(path: str, *, limit=100, offset=0):
    url = f"{JOLPICA}/{SEASON}{path}.json?{urlencode({'limit': limit, 'offset': offset})}"
    return get_json(url)["MRData"]


def fetch_all_results():
    """Jolpica's standard endpoint max limit is 100, so paginate *driver results*."""
    offset, limit = 0, 100
    by_round = {}
    while True:
        data = jolpica("/results", limit=limit, offset=offset)
        page = get_list(data, "RaceTable", "Races")
        fetched = 0
        for race in page:
            rows = race.get("Results", [])
            by_round.setdefault(str(race["round"]), []).extend(rows)
            fetched += len(rows)
        total = int(data.get("total", 0))
        if fetched == 0 or offset + limit >= total:
            break
        offset += limit
        if offset > 3000:
            raise RuntimeError("賽季成績頁數異常，已停止抓取")
    return by_round


def get_list(data, *path):
    for part in path:
        data = data.get(part, {}) if isinstance(data, dict) else {}
    return data if isinstance(data, list) else []


def matching_race_session(race: dict, sessions: list[dict]):
    race_date = parse_date(f"{race.get('date')}T{race.get('time', '12:00:00Z')}")
    if race_date is None:
        return None
    candidates = []
    for sess in sessions:
        if sess.get("session_name") != "Race" or sess.get("is_cancelled"):
            continue
        date = parse_date(sess.get("date_start"))
        if date:
            diff = abs((date - race_date).total_seconds())
            if diff < 48 * 3600:
                candidates.append((diff, sess))
    return min(candidates, key=lambda x: x[0])[1] if candidates else None


def important_event(event):
    category = str(event.get("category") or "").lower()
    msg = str(event.get("message") or "").upper()
    flag = str(event.get("flag") or "").upper()
    if category in ("safetycar", "carevent"):
        return True
    if flag in ("RED", "YELLOW", "DOUBLE YELLOW", "BLACK", "BLACK AND WHITE"):
        return True
    return any(s in msg for s in (
        "INCIDENT", "INVESTIGAT", "COLLISION", "PENALT", "SUMMON", "NOTED",
        "SAFETY CAR", "RED FLAG", "RETIRED", "STOPPED", "OFF TRACK", "CAR STOPPED"
    ))


def normalize_event(event):
    return {
        "date": event.get("date"),
        "lap": event.get("lap_number"),
        "category": event.get("category"),
        "flag": event.get("flag"),
        "driverNumber": event.get("driver_number"),
        "sessionKey": event.get("session_key"),
        "message": event.get("message") or "（未提供事件內容）",
    }


def build():
    now = datetime.now(timezone.utc)
    previous = load_prior()
    print(f"Preparing {SEASON} (non-live snapshot), now={now.isoformat()}")
    schedule_data = jolpica("")
    driver_data = jolpica("/driverstandings")
    team_data = jolpica("/constructorstandings")
    results = fetch_all_results()

    schedule = get_list(schedule_data, "RaceTable", "Races")
    drivers = get_list(driver_data, "StandingsTable", "StandingsLists")
    teams = get_list(team_data, "StandingsTable", "StandingsLists")
    events = {}
    warnings = []
    # Jolpica paginates driver entries (max 100 per request), not race rounds.
    # Optional session feeds must not block the rest of the free PWA.
    qualifying = get_session_results(SEASON, "qualifying", "QualifyingResults", get_json, JOLPICA)
    sprint = get_session_results(SEASON, "sprint", "SprintResults", get_json, JOLPICA)
    if qualifying is None:
        warnings.append("排位賽資料暫時無法完整取得，請稍後查看。")
        qualifying = previous.get("qualifyingResults", {}) if previous.get("season") == SEASON else {}
    if sprint is None:
        warnings.append("Sprint 成績暫時無法完整取得，請稍後查看。")
        sprint = previous.get("sprintResults", {}) if previous.get("season") == SEASON else {}

    # Only *historical* OpenF1 events: no live-session polling or claims of real-time coverage.
    completed = []
    for race in schedule:
        date = parse_date(f"{race.get('date')}T{race.get('time', '12:00:00Z')}")
        if date and date < now - timedelta(hours=12) and str(race.get("round")) in results:
            completed.append(race)

    if completed:
        sessions = get_json(f"{OPENF1}/sessions?{urlencode({'year': SEASON})}", optional=True)
        if not isinstance(sessions, list):
            sessions = []
            warnings.append("OpenF1 歷史事件暫時無法取得，賽果與積分不受影響。")
        for index, race in enumerate(completed, 1):
            rnd = str(race["round"])
            session = matching_race_session(race, sessions)
            if not session:
                continue
            key = session.get("session_key")
            raw = get_json(f"{OPENF1}/race_control?{urlencode({'session_key': key})}", optional=True)
            if isinstance(raw, list):
                # Preserve actual messages, without inferring collision responsibility.
                filtered = [normalize_event(e) for e in raw if important_event(e)]
                events[rnd] = sorted(filtered, key=lambda x: x.get("date") or "", reverse=True)[:120]
            elif previous.get("season") == SEASON:
                # Best effort: keep the previous historical snapshot if API is unavailable.
                events[rnd] = previous.get("events", {}).get(rnd, [])
            print(f"  historical round {rnd}: {len(events.get(rnd, []))} messages ({index}/{len(completed)})")

    # Build at most four new historical race analyses per run; reuse Actions cache.
    # Failure of optional OpenF1 data does not prevent standings / results.
    try:
        analysis_available = refresh_analyses(SEASON, completed, sessions if completed else [],
            results, matching_race_session, get_json, parse_date)
    except (OSError, ValueError, TypeError) as exc:
        analysis_available = []
        warnings.append(f"歷史賽事分析目前無法更新：{exc}")

    # Official after-each-round championship points; use cached snapshots to avoid
    # repeating requests for old races on each scheduled deployment.
    try:
        standings_history, history_errors = collect_official_history(
            SEASON, completed, get_json, JOLPICA)
        if history_errors:
            print(f"  standings history: {len(history_errors)} unavailable round feeds", file=sys.stderr)
            warnings.append("部分歷史積分回合暫時缺漏，折線圖不會自行補值。")
    except (OSError, ValueError, TypeError) as exc:
        standings_history = {"driver": {}, "constructor": {}}
        warnings.append(f"歷史積分走勢暫時無法更新：{exc}")

    payload = {
        "season": SEASON,
        "updatedAt": now.isoformat(),
        "schedule": schedule,
        "driverStandings": (drivers[0].get("DriverStandings", []) if drivers else []),
        "constructorStandings": (teams[0].get("ConstructorStandings", []) if teams else []),
        "standingsHistory": standings_history,
        "results": results,
        "qualifyingResults": qualifying,
        "sprintResults": sprint,
        "events": events,
        "analysisAvailable": analysis_available,
        "warnings": warnings,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUTPUT}: {len(schedule)} races, {len(results)} race rounds, {len(qualifying)} qualifying rounds, {len(sprint)} Sprint rounds, {len(events)} event rounds")


if __name__ == "__main__":
    try:
        build()
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        if os.environ.get("ALLOW_STALE_DATA") == "1":
            print("Using existing snapshot due to ALLOW_STALE_DATA=1", file=sys.stderr)
        else:
            sys.exit(1)
