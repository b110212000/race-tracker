import unittest
from update_data import important_event, matching_race_session


class DataPreparationTest(unittest.TestCase):
    def test_match_race_session_not_sprint(self):
        race = {"date": "2025-06-01", "time": "13:00:00Z"}
        sessions = [
            {"session_key": 1, "session_name": "Sprint", "date_start": "2025-06-01T13:00:00Z"},
            {"session_key": 2, "session_name": "Race", "date_start": "2025-06-01T13:00:00Z"},
        ]
        self.assertEqual(matching_race_session(race, sessions)["session_key"], 2)

    def test_collision_and_safety_car_are_events(self):
        self.assertTrue(important_event({"category": "Other", "message": "INCIDENT INVOLVING CAR 4 AND CAR 5"}))
        self.assertTrue(important_event({"category": "SafetyCar", "message": "SAFETY CAR DEPLOYED"}))
        self.assertFalse(important_event({"category": "Drs", "message": "DRS ENABLED"}))


if __name__ == "__main__":
    unittest.main()
