import unittest
from urllib.parse import parse_qs, urlparse
from weekend import get_session_results


class WeekendResultsTests(unittest.TestCase):
    def test_qualifying_paginates_driver_rows_across_rounds(self):
        calls = []
        def fetch(url, optional=False):
            self.assertTrue(optional)
            query = parse_qs(urlparse(url).query)
            offset = int(query["offset"][0])
            calls.append(offset)
            if offset == 0:
                races = [{"round": "1", "QualifyingResults": [
                    {"position": str(n), "Driver": {"driverId": f"d{n}"}} for n in range(1, 101)
                ]}]
            elif offset == 100:
                races = [
                    {"round": "1", "QualifyingResults": [{"position": "101", "Driver": {"driverId": "last"}}]},
                    {"round": "2", "QualifyingResults": [{"position": "1", "Driver": {"driverId": "first"}}]},
                ]
            else:
                raise AssertionError("Unexpected extra request")
            return {"MRData": {"total": "102", "RaceTable": {"Races": races}}}
        value = get_session_results(2026, "qualifying", "QualifyingResults", fetch, "https://test", 100)
        self.assertEqual(calls, [0, 100])
        self.assertEqual(len(value["1"]), 101)
        self.assertEqual(value["2"][0]["Driver"]["driverId"], "first")

    def test_sprint_handles_zero_results(self):
        value = get_session_results(
            2026, "sprint", "SprintResults",
            lambda url, optional=False: {"MRData": {"total": "0", "RaceTable": {"Races": []}}},
            "https://test")
        self.assertEqual(value, {})

    def test_page_failure_does_not_publish_partial_table(self):
        def fetch(url, optional=False):
            if "offset=100" in url:
                return None
            return {"MRData": {"total": "101", "RaceTable": {"Races": [
                {"round": "1", "SprintResults": [{"position": "1"}] * 100}
            ]}}}
        self.assertIsNone(get_session_results(2026, "sprint", "SprintResults", fetch, "https://test"))

    def test_rejects_unsupported_endpoint(self):
        with self.assertRaises(ValueError):
            get_session_results(2026, "paid-live", "Results", lambda *_: {}, "https://test")


if __name__ == "__main__":
    unittest.main()
