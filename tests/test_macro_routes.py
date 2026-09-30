from contextlib import asynccontextmanager
from datetime import timedelta
import sys
import unittest

from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from test_macro_reports import NOW
from api.macro_routes import install_macro_reports


class RoutesTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        from api.macro_reports import MacroReportService
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.service = MacroReportService(self.temp.name, providers={}, clock=lambda: NOW)
        self.app = FastAPI()
        async def test_admin(x_test_admin: str = Header(default="")):
            if x_test_admin != "test-only":
                raise HTTPException(401, "Unauthorized")
        install_macro_reports(self.app, service=self.service, admin_dependency=test_admin)
        self.client = TestClient(self.app)

    def test_report_routes(self):
        self.assertEqual(self.client.get("/api/reports/macro/today").status_code, 404)
        self.assertEqual(self.client.post("/api/admin/reports/macro/generate").status_code, 401)
        response = self.client.post("/api/admin/reports/macro/generate", headers={"X-Test-Admin":"test-only"})
        self.assertTrue(response.json()["created"])
        self.assertFalse(self.client.post("/api/admin/reports/macro/generate", headers={"X-Test-Admin":"test-only"}).json()["created"])
        self.assertEqual(self.client.get("/api/reports/macro/today").json(), self.service.read("2026-09-30"))
        self.assertEqual(self.client.get("/api/reports/macro/2026-09-30").status_code, 200)
        self.assertEqual(len(self.client.get("/api/reports/macro").json()["reports"]), 1)
        self.assertEqual(self.client.get("/api/reports/macro/2026-02-30").status_code, 400)
        self.assertEqual(self.client.get("/api/reports/macro/2026-09-29").status_code, 404)
        self.assertNotIn(self.temp.name, response.text)

    def test_fail_closed_and_lifecycle_preserved(self):
        events = []
        @asynccontextmanager
        async def existing_lifespan(app):
            events.append("start")
            yield
            events.append("stop")
        app = FastAPI(lifespan=existing_lifespan)
        install_macro_reports(app, service=self.service)
        with TestClient(app) as client:
            self.assertEqual(client.get("/api/reports/macro/today").status_code, 200)
            self.assertEqual(client.post("/api/admin/reports/macro/generate").status_code, 503)
        self.assertEqual(events, ["start", "stop"])
        self.assertFalse(app.state.macro_scheduler.thread.is_alive())

    def test_existing_score_routes_unchanged(self):
        # Actual score add-on from this checkout; NAS health/status/demo aren't here.
        sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1] / "api"))
        from score_routes import router
        self.app.include_router(router)
        for route in ("/score", "/score/BTC", "/market-regime"):
            self.assertEqual(self.client.get(route).status_code, 200)
        self.assertEqual(self.client.get("/score/UNKNOWN").status_code, 404)


if __name__ == "__main__":
    unittest.main()
