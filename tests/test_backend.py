"""Actual NAS main.py, with upstream I/O mocked and no real credentials."""
import importlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))


class BackendTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        with patch.dict("os.environ", {"DATA_DIR": self.temp.name}):
            import main
            self.main = importlib.reload(main)
        self.client = TestClient(self.main.app)
        self.main.macro_reports.provider_factory = None  # No external I/O in route regressions.

    def test_legacy_endpoints(self):
        response = Mock()
        response.json.return_value = {"status": "pong"}
        with patch.object(self.main.requests, "get", return_value=response):
            for route in ("/health", "/api/health"):
                self.assertEqual(self.client.get(route).json(), {"ok": True})
        with patch.object(self.main, "build_payload", return_value={"ok": True, "test_fixture": True}):
            for route in ("/status", "/api/status", "/api/demo"):
                self.assertEqual(self.client.get(route).status_code, 200)
        for route in ("/score", "/api/score", "/score/BTC", "/market-regime"):
            self.assertEqual(self.client.get(route).status_code, 200)

    def test_existing_credentials_protect_manual_generation(self):
        with patch.object(self.main, "load_credentials", return_value=("test-owner", "test-password")):
            route = "/api/admin/reports/macro/generate"
            self.assertEqual(self.client.post(route).status_code, 401)
            self.assertEqual(self.client.post(route, auth=("test-owner", "wrong")).status_code, 401)
            response = self.client.post(route, auth=("test-owner", "test-password"))
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()["created"])
            self.assertFalse(self.client.post(route, auth=("test-owner", "test-password")).json()["created"])
        with patch.object(self.main, "load_credentials", side_effect=OSError("internal config path")):
            response = self.client.post(route)
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("internal config path", response.text)

    def test_lifespan_catchup(self):
        with TestClient(self.main.app):
            self.assertIsNotNone(self.main.app.state.macro_scheduler.thread)
        self.assertFalse(self.main.app.state.macro_scheduler.thread.is_alive())
