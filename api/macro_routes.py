"""Opt-in integration with the existing TradeRouter FastAPI application."""
from contextlib import asynccontextmanager
import logging

from fastapi import APIRouter, Depends, HTTPException

try:  # Supports repository imports and deployment beside main.py.
    from .macro_reports import MacroReportService, MacroScheduler, ReportUnavailable, local_time, validate_date
except ImportError:
    from macro_reports import MacroReportService, MacroScheduler, ReportUnavailable, local_time, validate_date


def create_macro_router(service, admin_dependency=None):
    router = APIRouter(tags=["Daily Macro Base Report"])

    def read(day):
        try:
            validate_date(day)
            report = service.read(day)
        except ValueError:
            raise HTTPException(400, "Expected a valid YYYY-MM-DD date")
        except ReportUnavailable:
            raise HTTPException(503, "Macro report unavailable")
        if report is None:
            raise HTTPException(404, "Macro report not found")
        return report

    @router.get("/api/reports/macro/today")
    def today():
        return read(local_time(service.clock()).date().isoformat())

    @router.get("/api/reports/macro")
    def index():
        return {"reports": service.index(), "latest": service.get_latest_macro_score()}

    @router.get("/api/reports/macro/{report_date}")
    def dated(report_date: str):
        return read(report_date)

    def admin_unconfigured():
        raise HTTPException(503, "Existing admin authentication must be configured")

    @router.post("/api/admin/reports/macro/generate", dependencies=[Depends(admin_dependency or admin_unconfigured)])
    def generate():
        try:
            report, created = service.generate()
            return {"created": created, "report": report}
        except Exception:
            logging.getLogger(__name__).exception("Manual macro generation failed")
            raise HTTPException(503, "Macro report generation unavailable")

    return router


def install_macro_reports(app, *, admin_dependency=None, service=None):
    """Call once after existing routes/lifespan setup, before the app starts.

    Pass the existing FastAPI authentication dependency, which must reject
    non-admin callers and enforce any existing session/CSRF requirements.
    Without it, manual generation is explicitly disabled (503).
    """
    if hasattr(app.state, "macro_reports"):
        raise ValueError("Macro reports already installed")
    service = service or MacroReportService()
    scheduler = MacroScheduler(service)
    previous_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(application):
        async with previous_lifespan(application) as state:
            scheduler.start()
            try:
                yield state
            finally:
                scheduler.stop()

    app.router.lifespan_context = lifespan
    app.state.macro_reports = service
    app.state.macro_scheduler = scheduler
    app.include_router(create_macro_router(service, admin_dependency))
    return service
