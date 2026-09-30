"""Synthetic HTTP fixtures only; no secrets or live upstream calls."""
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.fred_macro import COMPONENTS, POLICIES, FredMacroRun, FredUnavailable
from api.macro_reports import BRISBANE, MacroReportService

NOW = datetime(2026, 9, 30, 7, tzinfo=BRISBANE)
SECRET = "test-key-never-log"


def response(rows=None, status=200):
    result = Mock(status_code=status)
    result.json.return_value = {"observations": rows or []}
    return result


def row(day, value):
    return dict(date=day, value=str(value))


def fixtures():
    result = {s: [row("2026-09-29", 100), row("2026-09-22", 99)]
              for ids in COMPONENTS.values() for s in ids}
    result.update(DGS2=[row("2026-09-29", 4), row("2026-09-22", 4.1)],
                  DGS10=[row("2026-09-29", 4.2), row("2026-09-22", 4.3)],
                  DTWEXBGS=[row("2026-09-25", 120), row("2026-09-18", 121)],
                  VIXCLS=[row("2026-09-29", 20)],
                  NFCI=[row("2026-09-18", -.5)],
                  WALCL=[row("2026-09-23", 6700000), row("2026-08-26", 6600000)])
    return result


class FredTest(unittest.TestCase):
    def make_run(self, data=None):
        session = Mock()
        data = fixtures() if data is None else data
        session.get.side_effect = lambda url, **kw: response(data[kw["params"]["series_id"]])
        return FredMacroRun(session=session, api_key=SECRET, sleep=Mock())

    def service(self, run):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        return MacroReportService(temp.name, clock=lambda: NOW, provider_factory=lambda: run)

    def test_all_five_components_dates_and_formulas(self):
        run = self.make_run()
        report = self.service(run).build()
        components = report["components"]
        self.assertEqual(report["scoring"]["coverage"], .9)
        self.assertEqual(report["confidence"], 72)
        self.assertEqual(components["rates"]["score"], 60)
        self.assertEqual(components["volatility"]["score"], 50)
        self.assertGreater(components["usd"]["score"], 50)
        self.assertGreater(components["equities"]["score"], 50)
        self.assertGreater(components["liquidity"]["score"], 50)
        self.assertEqual(components["macro_events"]["status"], "unavailable")
        observations = components["liquidity"]["provenance"]["observations"]
        self.assertEqual([e["observation_date"] for e in observations], ["2026-09-18", "2026-09-23"])
        self.assertTrue(components["liquidity"]["source_timestamp"].startswith("2026-09-18"))
        self.assertIn("looser", components["liquidity"]["summary"])
        self.assertEqual(run.session.get.call_count, 8)
        run.session.close.assert_called_once()
        self.assertNotIn(SECRET, json.dumps(report))

    def test_nfci_sign_and_weekly_walcl(self):
        data = fixtures()
        data["NFCI"] = [row("2026-09-18", .5)]
        data["WALCL"][0]["value"] = "6500000"
        component = self.service(self.make_run(data)).build()["components"]["liquidity"]
        self.assertLess(component["score"], 50)
        self.assertIn("tighter", component["summary"])
        self.assertEqual(component["provenance"]["observations"][1]["freshness"]["frequency"], "weekly")

    def test_freshness_weekend_holiday_publication_and_timezone(self):
        daily = POLICIES["SP500"]
        friday = datetime(2026, 9, 25, tzinfo=BRISBANE).date()
        # Tuesday Brisbane morning after a Monday US holiday is still accepted.
        self.assertTrue(daily.valid(friday, NOW - timedelta(days=1)))
        self.assertTrue(daily.valid(friday, NOW))  # three weekday tolerance
        self.assertFalse(daily.valid(friday, NOW + timedelta(days=1)))
        self.assertTrue(POLICIES["DTWEXBGS"].valid(friday, NOW + timedelta(days=5)))
        self.assertFalse(POLICIES["DTWEXBGS"].valid(friday, NOW + timedelta(days=6)))
        self.assertTrue(POLICIES["NFCI"].valid(NOW.date() - timedelta(days=14), NOW))
        self.assertFalse(POLICIES["NFCI"].valid(NOW.date() - timedelta(days=15), NOW))
        self.assertTrue(POLICIES["WALCL"].valid(NOW.date() - timedelta(days=10), NOW))
        self.assertFalse(POLICIES["WALCL"].valid(NOW.date() - timedelta(days=11), NOW))
        self.assertFalse(daily.valid(NOW.date() + timedelta(days=1), NOW))
        self.assertEqual(daily.valid(friday, NOW), daily.valid(friday, NOW.astimezone(timezone.utc)))

    def test_missing_marker_latest_valid_and_stale_provenance(self):
        data = fixtures()
        data["SP500"].insert(0, row("2026-09-30", "."))
        component = self.service(self.make_run(data)).build()["components"]["equities"]
        self.assertEqual(component["provenance"]["observations"][0]["observation_date"], "2026-09-29")
        data["SP500"] = [row("2026-09-18", 100), row("2026-09-11", 99)]
        report = self.service(self.make_run(data)).build()
        component = report["components"]["equities"]
        self.assertIsNone(component["score"])
        self.assertEqual(component["status"], "unavailable")
        self.assertIn("stale", component["summary"])
        self.assertEqual(component["provenance"]["observations"][0]["observation_date"], "2026-09-18")
        self.assertEqual(report["scoring"]["coverage"], .7)

    def test_malformed_empty_future_and_partial_data(self):
        for bad in ([], [row("2026-10-01", 100)], [row("nonsense", 100)],
                    [row("2026-09-29", "nan")], [row("2026-09-29", "inf")],
                    [row("2026-09-29", True)], [row("2026-09-29", 0)],
                    [row("2026-09-29", -1)], [row("2026-09-29", ".")]):
            with self.subTest(bad=bad):
                data = fixtures()
                data["NASDAQCOM"] = bad
                report = self.service(self.make_run(data)).build()
                self.assertIsNone(report["components"]["equities"]["score"])
                self.assertIsNotNone(report["components"]["rates"]["score"])
        data = fixtures()
        data["WALCL"] = [row("2026-09-23", 6700000), row("2026-08-01", 6600000)]
        self.assertIn("history", self.service(self.make_run(data)).build()["components"]["liquidity"]["summary"])

    def test_missing_key_no_network_and_no_secret_diagnostics(self):
        run = FredMacroRun(session=Mock(), api_key="")
        report = self.service(run).build()
        run.session.get.assert_not_called()
        self.assertIsNone(report["macro_score"])
        run = self.make_run()
        run.session.get.side_effect = requests.ConnectionError("request?api_key=" + SECRET)
        with self.assertLogs("api.fred_macro", level="INFO") as logs:
            component = run.providers["usd"](NOW)
        self.assertEqual(run.session.get.call_count, 2)
        self.assertNotIn(SECRET, str(logs.output) + json.dumps(component))

    def test_http_errors_retries_and_error_cache(self):
        for status in (400, 401, 403, 429, 500, 503):
            run = self.make_run()
            run.session.get.side_effect = None
            run.session.get.return_value = response(status=status)
            with self.assertRaises(FredUnavailable):
                run.observations("DGS2", NOW)
            expected = 2 if status in (500, 503) else 1
            self.assertEqual(run.session.get.call_count, expected)
            with self.assertRaises(FredUnavailable):
                run.observations("DGS2", NOW)
            self.assertEqual(run.session.get.call_count, expected)
            if status == 429:
                with self.assertRaises(FredUnavailable):
                    run.observations("DGS10", NOW)
                self.assertEqual(run.session.get.call_count, 1)
        run = self.make_run()
        run.session.get.side_effect = [requests.Timeout(SECRET), response(fixtures()["DGS2"])]
        self.assertEqual(run.observations("DGS2", NOW)[0][1], 4)
        self.assertEqual(run.session.get.call_args.kwargs["timeout"], (3.05, 10))
        run.sleep.assert_called_once_with(.5)
        run = self.make_run()
        run.session.get.side_effect = [response(status=503), response(status=429)]
        with self.assertRaises(FredUnavailable):
            run.observations("DGS2", NOW)
        with self.assertRaises(FredUnavailable):
            run.observations("DGS10", NOW)
        self.assertEqual(run.session.get.call_count, 2)

    def test_per_run_cache_duplicate_and_new_run(self):
        runs = []
        def factory():
            run = self.make_run()
            runs.append(run)
            return run
        service = self.service(self.make_run())
        service.provider_factory = factory
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: service.generate(), range(8)))
        self.assertEqual(sum(created for _, created in results), 1)
        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0].session.get.call_count, 8)
        service.build()
        self.assertEqual(len(runs), 2)
        self.assertEqual(runs[1].session.get.call_count, 8)
        run = self.make_run()
        run.providers["rates"](NOW)
        run.providers["rates"](NOW)
        self.assertEqual(run.session.get.call_count, 2)

    def test_default_factory_environment_and_disabled_provider_injection(self):
        with patch.dict("os.environ", {"FRED_API_KEY": SECRET}):
            with FredMacroRun(session=Mock()) as run:
                self.assertEqual(run.key, SECRET)
        self.assertIsNone(MacroReportService(providers={}).provider_factory)


if __name__ == "__main__":
    unittest.main()
