import unittest
from datetime import datetime, timezone
from analysis import sample_lap_positions, normalize_stints, normalize_pits


def date(value):
    if value is None:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


class RaceAnalysisTests(unittest.TestCase):
    def test_samples_lap_position_changes_without_inventing_missing_drivers(self):
        positions = [
            {"date": "2026-03-01T10:00:00Z", "driver_number": 4, "position": 1},
            {"date": "2026-03-01T10:00:00Z", "driver_number": 1, "position": 2},
            {"date": "2026-03-01T10:02:10Z", "driver_number": 1, "position": 1},
            {"date": "2026-03-01T10:02:10Z", "driver_number": 4, "position": 2},
        ]
        laps = [
            {"lap_number": 1, "date_start": "2026-03-01T10:00:00Z", "lap_duration": 60},
            {"lap_number": 2, "date_start": "2026-03-01T10:02:00Z", "lap_duration": 60},
        ]
        result = sample_lap_positions(positions, laps, date)
        self.assertEqual([x["lap"] for x in result], [1, 2])
        self.assertEqual(result[0]["positions"][0]["number"], 4)
        self.assertEqual(result[1]["positions"][0]["number"], 1)

    def test_invalid_lap_does_not_create_snapshot(self):
        laps = [{"lap_number": 1, "date_start": None, "lap_duration": None}]
        self.assertEqual(sample_lap_positions([], laps, date), [])

    def test_stints_keep_actual_tyre_age_and_lap_range(self):
        rows = [{"driver_number": 16, "lap_start": 4, "lap_end": 21,
                 "compound": "MEDIUM", "tyre_age_at_start": 2}]
        result = normalize_stints(rows)
        self.assertEqual(result[0]["compound"], "MEDIUM")
        self.assertEqual(result[0]["tyreAgeStart"], 2)

    def test_pit_lane_time_not_mislabelled_as_stationary_stop(self):
        rows = [{"driver_number": 16, "lap_number": 12, "lane_duration": 22.4}]
        result = normalize_pits(rows)
        self.assertIsNone(result[0]["stopDuration"])
        self.assertEqual(result[0]["laneDuration"], 22.4)


if __name__ == "__main__":
    unittest.main()
