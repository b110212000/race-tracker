import unittest
from standings_history import parse_standings, collect_official_history

class StandingsHistoryTests(unittest.TestCase):
    def test_compact_official_driver_points(self):
        data = {"MRData":{"StandingsTable":{"StandingsLists":[{
            "DriverStandings":[
                {"position":"1","points":"124.5","Driver":{"driverId":"driver_a"}},
                {"position":"2","points":"102","Driver":{"driverId":"driver_b"}},
            ]}]}}}
        self.assertEqual(parse_standings(data, "driver"), [
            {"id":"driver_a","points":124.5,"position":1},
            {"id":"driver_b","points":102.0,"position":2}
        ])
    def test_constructor_standings(self):
        data = {"MRData":{"StandingsTable":{"StandingsLists":[{
            "ConstructorStandings":[{"position":"3","points":"76","Constructor":{"constructorId":"team_a"}}]}]}}}
        self.assertEqual(parse_standings(data, "constructor"), [{"id":"team_a","points":76.0,"position":3}])
    def test_missing_not_assumed_zero(self):
        self.assertIsNone(parse_standings({"MRData":{"StandingsTable":{"StandingsLists":[]}}}, "driver"))
        self.assertIsNone(parse_standings(None, "driver"))
    def test_round_collection_keeps_gaps(self):
        # Patching loader avoids writes and isolates the aggregator logic.
        import standings_history as module
        old=module.load_or_fetch_round
        module.load_or_fetch_round=lambda year, rnd, kind, *_: None if rnd=="2" else [{"id":"a","position":1,"points":25}]
        try:
            data, errors=collect_official_history(2026,[{"round":"1"},{"round":"2"}], lambda *args,**kwargs:None,"https://test")
        finally:
            module.load_or_fetch_round=old
        self.assertEqual(list(data["driver"]), ["1"])
        self.assertEqual(list(data["constructor"]), ["1"])
        self.assertEqual(len(errors), 2)

if __name__ == "__main__":
    unittest.main()
