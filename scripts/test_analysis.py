import unittest
from datetime import datetime, timezone
from analysis import sample_lap_positions, normalize_stints, normalize_pits, normalize_lap_times


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


    def test_real_lap_durations_and_sectors_are_preserved(self):
        source = [
            {"driver_number": 44, "lap_number": 3, "lap_duration": 91.744,
             "duration_sector_1": 27.2, "duration_sector_2": 39.1,
             "duration_sector_3": 25.444, "is_pit_out_lap": False},
            {"driver_number": 44, "lap_number": 4, "lap_duration": 106.5,
             "duration_sector_1": None, "duration_sector_2": 40.0,
             "duration_sector_3": 30.0, "is_pit_out_lap": True},
        ]
        rec = normalize_lap_times(source)
        self.assertEqual(len(rec), 2)
        self.assertEqual(rec[0]["time"], 91.744)
        self.assertEqual(rec[0]["sectors"], [27.2, 39.1, 25.444])
        self.assertTrue(rec[1]["pitOut"])
        self.assertEqual(rec[1]["sectors"][0], None)

    def test_invalid_and_missing_lap_duration_is_not_invented(self):
        source = [
            {"driver_number": 4, "lap_number": 3, "lap_duration": None},
            {"driver_number": 4, "lap_number": 4, "lap_duration": -40},
            {"driver_number": 4, "lap_number": 5, "lap_duration": 89.99},
        ]
        rec = normalize_lap_times(source)
        self.assertEqual(len(rec), 1)
        self.assertEqual(rec[0]["lap"], 5)

    def test_duplicate_lap_prefers_complete_sector_timing(self):
        source = [
            {"driver_number": 16, "lap_number": 10, "lap_duration": 90.01},
            {"driver_number": 16, "lap_number": 10, "lap_duration": 90.01,
             "duration_sector_1": 29, "duration_sector_2": 32,
             "duration_sector_3": 29.01},
        ]
        rec = normalize_lap_times(source)
        self.assertEqual(len(rec), 1)
        self.assertEqual(rec[0]["sectors"], [29.0, 32.0, 29.01])


if __name__ == "__main__":
    unittest.main()
