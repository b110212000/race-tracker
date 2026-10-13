"""Fetch season qualifying and Sprint results with Jolpica's 100-row pagination.

These are completed-session historical records, never live timing.
"""
from urllib.parse import urlencode


def get_session_results(season, endpoint, field, get_json, base_url, limit=100):
    """Return by-round rows, or None if any page is unavailable.

    Jolpica paginates individual driver results, not whole race objects.
    Do not show an incomplete partial page as an official classification.
    """
    if endpoint not in ("qualifying", "sprint"):
        raise ValueError("Unsupported F1 session endpoint")
    by_round = {}
    offset = 0
    while offset <= 3000:
        url = f"{base_url}/{season}/{endpoint}.json?{urlencode({'limit': limit, 'offset': offset})}"
        response = get_json(url, optional=True)
        if not isinstance(response, dict) or not isinstance(response.get("MRData"), dict):
            return None
        payload = response["MRData"]
        table = payload.get("RaceTable") or {}
        races = table.get("Races") or []
        if not isinstance(races, list):
            return None
        received = 0
        for race in races:
            if not isinstance(race, dict) or race.get("round") is None:
                continue
            rows = race.get(field) or []
            if not isinstance(rows, list):
                return None
            by_round.setdefault(str(race["round"]), []).extend(rows)
            received += len(rows)
        try:
            total = int(payload.get("total", 0))
        except (ValueError, TypeError):
            return None
        if offset + limit >= total or received == 0:
            break
        offset += limit
    else:
        return None
    # Preserve Jolpica fields Q1/Q2/Q3, grid, status etc; numeric sort only.
    for round_rows in by_round.values():
        round_rows.sort(key=lambda x: (
            int(x.get("position", "999")) if str(x.get("position", "")).isdigit() else 999,
            str((x.get("Driver") or {}).get("driverId", ""))
        ))
    return by_round
