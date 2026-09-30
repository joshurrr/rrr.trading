from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.macro_reports import (BRISBANE, WEIGHTS, MacroReportService,
                               MacroScheduler, ReportUnavailable, regime)

NOW = datetime(2026, 9, 30, 7, tzinfo=BRISBANE)


def provider(score=70, confidence=80, stamp=NOW):
    return lambda now: dict(score=score, confidence=confidence,
                            source_timestamp=stamp.isoformat(),
                            sources=["https://example.org/official-series"],
                            summary="Test-only macro observation")


class ReportsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.service = MacroReportService(self.temp.name, providers={}, clock=lambda: NOW)

    def test_unavailable_generation_and_schema(self):
        report = self.service.build()
        self.assertIsNone(report["macro_score"])
        self.assertEqual(report["confidence"], 0)
        self.assertEqual(report["macro_regime"], "unavailable")
        self.assertEqual(report["scoring"]["contributing_components"], [])
        self.assertEqual(set(report["components"]), set(WEIGHTS))
        self.assertTrue(all(c["score"] is None for c in report["components"].values()))

    def test_weighting_and_partial_confidence(self):
        self.service.providers = dict(rates=provider(20), usd=provider(80))
        report = self.service.build()
        self.assertEqual(report["macro_score"], 45.7)
        self.assertEqual(report["confidence"], 28)
        self.assertEqual(report["scoring"]["coverage"], .35)
        self.assertAlmostEqual(sum(report["scoring"]["effective_weights"].values()), 1)
        weights = dict(WEIGHTS, rates=0, usd=100)
        service = MacroReportService(self.temp.name, self.service.providers, weights)
        self.assertEqual(service.build(NOW)["macro_score"], 80)

    def test_full_coverage(self):
        self.service.providers = {n: provider() for n in WEIGHTS}
        report = self.service.build()
        self.assertEqual(report["macro_score"], 70)
        self.assertEqual(report["confidence"], 80)
        self.assertEqual(report["scoring"]["coverage"], 1)

    def test_regime_boundaries(self):
        expected = {0:"strongly risk-off", 19.9:"strongly risk-off",20:"risk-off",
                    39.9:"risk-off",40:"neutral / mixed",59.9:"neutral / mixed",
                    60:"risk-on",79.9:"risk-on",80:"strongly risk-on",100:"strongly risk-on"}
        for score, label in expected.items():
            self.assertEqual(regime(score), label)

    def test_invalid_stale_future_and_failed_inputs(self):
        for score in (True, "70", -1, 101, float("nan"), float("inf")):
            self.service.providers = dict(rates=provider(score))
            self.assertIsNone(self.service.build()["macro_score"])
        for stamp in (NOW - timedelta(hours=37), NOW + timedelta(seconds=1), NOW.replace(tzinfo=None)):
            self.service.providers = dict(rates=provider(stamp=stamp))
            self.assertIsNone(self.service.build()["macro_score"])
        self.service.providers = dict(rates=lambda now: 1 / 0)
        with self.assertLogs("api.macro_reports", level="ERROR"):
            self.assertIsNone(self.service.build()["macro_score"])
        self.service.providers = dict(rates=lambda now: dict(score=70, confidence=80))
        with self.assertLogs("api.macro_reports", level="ERROR"):
            self.assertIsNone(self.service.build()["macro_score"])

    def test_persistence_immutable_and_concurrent(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.service.generate(), range(16)))
        self.assertEqual(sum(created for _, created in results), 1)
        original = (self.service.directory / "2026-09-30.json").read_bytes()
        self.service.providers = dict(rates=provider())
        report, created = self.service.generate()
        self.assertFalse(created)
        self.assertIsNone(report["macro_score"])
        self.assertEqual((self.service.directory / "2026-09-30.json").read_bytes(), original)
        self.assertEqual(list(self.service.directory.glob("*.tmp")), [])

    def test_atomic_failure_does_not_publish(self):
        with patch("api.macro_reports.os.link", side_effect=OSError("test failure")):
            with self.assertRaises(OSError):
                self.service.generate()
        self.assertIsNone(self.service.read("2026-09-30"))
        self.assertEqual(list(self.service.directory.iterdir()), [])

    def test_startup_catchup_timezone_and_restart(self):
        self.assertEqual(self.service.catch_up(NOW - timedelta(seconds=1)), (None, False))
        # 21:00 UTC on previous date is 07:00 Brisbane today.
        report, created = self.service.catch_up(datetime(2026, 9, 29, 21, tzinfo=timezone.utc))
        self.assertTrue(created)
        self.assertEqual(report["report_date"], "2026-09-30")
        self.assertTrue(report["generated_at"].endswith("+10:00"))
        restarted = MacroReportService(self.temp.name, providers={}, clock=lambda: NOW)
        scheduler = MacroScheduler(restarted)
        scheduler.start()
        self.addCleanup(scheduler.stop)
        self.assertFalse(scheduler.tick()[1])
        scheduler.stop()
        self.assertFalse(scheduler.thread.is_alive())
        with self.assertRaises(ValueError):
            self.service.build(NOW.replace(tzinfo=None))

    def test_index_retrieval_missing_invalid_corrupt(self):
        self.service.generate(NOW)
        self.service.generate(NOW + timedelta(days=1))
        self.assertEqual([r["report_date"] for r in self.service.index()], ["2026-10-01", "2026-09-30"])
        self.assertIsNone(self.service.read("2026-09-28"))
        for day in ("../../secret", "2026-02-30", "2026-9-30", "2026-09-30.json"):
            with self.assertRaises(ValueError):
                self.service.read(day)
        (self.service.directory / "2026-10-02.json").write_text("{", encoding="utf-8")
        with self.assertLogs("api.macro_reports"):
            with self.assertRaises(ReportUnavailable):
                self.service.read("2026-10-02")
            self.assertEqual(len(self.service.index()), 2)

    def test_latest_staleness(self):
        self.assertTrue(self.service.get_latest_macro_score()["stale"])
        self.service.generate()
        self.assertFalse(self.service.get_latest_macro_score()["stale"])
        self.assertFalse(self.service.get_latest_macro_score(NOW + timedelta(days=1, seconds=-1))["stale"])
        self.assertTrue(self.service.get_latest_macro_score(NOW + timedelta(days=1))["stale"])
        self.assertFalse(self.service.get_latest_macro_score()["available"])

    def test_scheduler_failure_retries(self):
        scheduler = MacroScheduler(self.service)
        with patch.object(self.service, "catch_up", side_effect=OSError("test failure")):
            with self.assertLogs("api.macro_reports", level="ERROR"):
                self.assertEqual(scheduler.tick(), (None, False))
        self.assertTrue(scheduler.tick()[1])
        self.assertFalse(scheduler.tick()[1])


if __name__ == "__main__":
    unittest.main()
