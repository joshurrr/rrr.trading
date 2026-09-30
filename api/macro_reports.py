"""Immutable global macro snapshots. No asset scores or trading decisions.

Providers supply already-normalized macro assessments, with explicit provenance.
Raw-series adapters should live outside this service and document normalization.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
import json
import logging
import math
import os
from pathlib import Path
import re
import tempfile
import threading
from zoneinfo import ZoneInfo

try:
    from .fred_macro import FredMacroRun, POLICIES
except ImportError:
    from fred_macro import FredMacroRun, POLICIES

LOG = logging.getLogger(__name__)
BRISBANE = ZoneInfo("Australia/Brisbane")
WEIGHTS = dict(rates=20, usd=15, equities=20, liquidity=20,
               volatility=15, macro_events=10)
MAX_INPUT_AGE = timedelta(hours=36)


def brisbane_now():
    return datetime.now(BRISBANE)


def local_time(now):
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Timezone-aware datetime required")
    return now.astimezone(BRISBANE)


def validate_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Expected a valid YYYY-MM-DD date")
    date.fromisoformat(value)
    return value


def regime(score):
    if score is None:
        return "unavailable"
    for ceiling, label in ((20, "strongly risk-off"), (40, "risk-off"),
                           (60, "neutral / mixed"), (80, "risk-on")):
        if score < ceiling:
            return label
    return "strongly risk-on"


def number(value):
    return type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 100


def unavailable(reason="Data source not yet connected", status="unavailable"):
    return dict(score=None, status=status, summary=reason,
                source_timestamp=None, sources=[], confidence=0)


class ReportUnavailable(Exception):
    """A stored snapshot cannot be read safely."""


class MacroReportService:
    def __init__(self, data_dir=None, providers=None, weights=None, clock=brisbane_now,
                 provider_factory=FredMacroRun):
        self.directory = Path(data_dir or os.getenv("DATA_DIR", "/data")) / "reports" / "macro"
        self.providers = dict(providers or {})
        # Explicit providers (including {}) retain the injection/disabled contract.
        # A fresh factory instance isolates HTTP sessions and caches per build.
        self.provider_factory = provider_factory if providers is None else None
        self.weights = dict(WEIGHTS if weights is None else weights)
        if set(self.weights) != set(WEIGHTS) or any(
            type(w) not in (int, float) or not math.isfinite(w) or w < 0
            for w in self.weights.values()
        ) or not sum(self.weights.values()):
            raise ValueError("Weights must specify all six components and a positive total")
        if set(self.providers) - set(WEIGHTS):
            raise ValueError("Unknown macro component provider")
        self.clock = clock
        self._generation_lock = threading.Lock()

    def read(self, report_date):
        path = self.directory / (validate_date(report_date) + ".json")
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(value, dict) or value.get("report_date") != report_date:
                raise ValueError("Invalid stored snapshot")
            return value
        except FileNotFoundError:
            return None
        except (OSError, ValueError) as exc:
            LOG.exception("Macro snapshot read failed for %s", report_date)
            raise ReportUnavailable("Macro snapshot unavailable") from exc

    def assess(self, name, now, providers=None):
        providers = self.providers if providers is None else providers
        if name not in providers:
            return unavailable()
        try:
            provider = providers[name]
            raw = provider(now)
            if isinstance(raw, dict) and raw.get("score") is None and raw.get("status") == "unavailable":
                result = unavailable(raw.get("summary") or "Data provider unavailable")
                if "provenance" in raw:
                    result.update(provenance=raw["provenance"], sources=raw.get("sources", []))
                return result
            if not isinstance(raw, dict) or not number(raw.get("score")) or not number(raw.get("confidence")):
                return unavailable("Provider did not supply a valid score and confidence")
            stamp = datetime.fromisoformat(raw["source_timestamp"])
            stamp = local_time(stamp)
            freshness = getattr(provider, "validate_freshness", None)
            fresh = freshness(raw, now) if callable(freshness) else now - stamp <= MAX_INPUT_AGE
            if stamp > now or not fresh:
                return unavailable("Source observation is stale or future-dated", "stale")
            if not isinstance(raw.get("sources"), list) or not raw["sources"] or not all(
                isinstance(s, str) and s.startswith("https://") for s in raw["sources"]
            ):
                return unavailable("Provider did not supply source URLs")
            if not isinstance(raw.get("summary"), str) or not raw["summary"].strip():
                return unavailable("Provider did not supply an assessment summary")
            result = dict(score=raw["score"], confidence=raw["confidence"],
                        status=regime(raw["score"]), summary=raw["summary"],
                        source_timestamp=stamp.isoformat(), sources=raw["sources"])
            if "provenance" in raw:
                result["provenance"] = raw["provenance"]
            return result
        except Exception:
            LOG.exception("Macro provider failed: %s", name)
            return unavailable("Data provider failed")

    def build(self, now=None):
        now = local_time(now or self.clock())
        if self.provider_factory is not None and not self.providers:
            with self.provider_factory() as run:
                components = {name: self.assess(name, now, run.providers) for name in self.weights}
        else:
            components = {name: self.assess(name, now) for name in self.weights}
        contributing = [name for name, c in components.items()
                        if c["score"] is not None and self.weights[name] > 0]
        used_weight = sum(self.weights[n] for n in contributing)
        total_weight = sum(self.weights.values())
        effective = {n: self.weights[n] / used_weight if n in contributing else 0
                     for n in components}
        score = round(sum(components[n]["score"] * effective[n] for n in contributing), 1) if contributing else None
        # Evidence confidence, penalized for missing weighted coverage. Not a win probability.
        confidence = round(sum(components[n]["confidence"] * self.weights[n]
                               for n in contributing) / total_weight, 1)
        classification = regime(score)
        missing = [n for n in components if n not in contributing and self.weights[n] > 0]
        risks = [f"{n}: {components[n]['summary']}" for n in contributing
                 if components[n]["score"] < 40]
        if missing:
            risks.append("Incomplete macro coverage: " + ", ".join(missing))
        summary = (f"Available global macro evidence is {classification} (score {score}/100). "
                   f"{len(contributing)} of six components contribute; confidence {confidence}/100."
                   if contributing else "Global macro conditions cannot yet be assessed: no valid macro inputs are connected.")
        return dict(report_date=now.date().isoformat(), generated_at=now.isoformat(),
                    timezone="Australia/Brisbane", report_type="macro_base", report_version=1,
                    macro_score=score, macro_regime=classification, confidence=confidence,
                    components=components, summary=summary, risks=risks,
                    scoring=dict(weights=self.weights, effective_weights=effective,
                                 contributing_components=contributing,
                                 coverage=round(used_weight / total_weight, 4),
                                 confidence_method="weighted source confidence multiplied by coverage",
                                 max_input_age_hours=36,
                                 fred_freshness={s: p.describe() for s, p in POLICIES.items()}))

    def generate(self, now=None):
        # Scheduler and manual requests in this worker share one upstream build.
        # Atomic publication below still arbitrates independent worker processes.
        with self._generation_lock:
            return self._generate_once(now)

    def _generate_once(self, now=None):
        now = local_time(now or self.clock())
        day = now.date().isoformat()
        existing = self.read(day)
        if existing is not None:
            return existing, False
        report = self.build(now)
        self.directory.mkdir(parents=True, exist_ok=True)
        target = self.directory / (day + ".json")
        # Hard-link publication is atomic AND no-clobber, including across processes.
        # Temp and destination share a filesystem. Fail closed if links unsupported.
        fd, temp = tempfile.mkstemp(prefix=".macro-", suffix=".tmp", dir=self.directory)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                json.dump(report, stream, ensure_ascii=False, allow_nan=False, indent=2)
                stream.write("\n")
                stream.flush()
                os.fsync(stream.fileno())
            try:
                os.link(temp, target)
            except FileExistsError:
                return self.read(day), False
            if os.name == "posix":
                directory_fd = os.open(self.directory, os.O_RDONLY)
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)
            LOG.info("Macro report generated for %s", day)
            return report, True
        finally:
            Path(temp).unlink(missing_ok=True)

    def index(self):
        fields = ("report_date", "generated_at", "macro_score", "macro_regime", "confidence", "summary")
        result = []
        for path in sorted(self.directory.glob("*.json"), reverse=True):
            try:
                report = self.read(validate_date(path.stem))
                if report:
                    result.append({field: report[field] for field in fields})
            except (ValueError, KeyError, ReportUnavailable):
                LOG.warning("Skipping invalid macro snapshot in index")
        return result

    def get_latest_macro_score(self, now=None):
        now = local_time(now or self.clock())
        # Before 07:00 the previous Brisbane day's report is still current.
        expected = now.date() if now.time() >= time(7) else now.date() - timedelta(days=1)
        reports = [r for r in self.index() if r["report_date"] <= now.date().isoformat()]
        latest = reports[0] if reports else None
        return dict(macro_score=latest["macro_score"] if latest else None,
                    report_date=latest["report_date"] if latest else None,
                    confidence=latest["confidence"] if latest else 0,
                    regime=latest["macro_regime"] if latest else "unavailable",
                    stale=not latest or latest["report_date"] < expected.isoformat(),
                    available=bool(latest and latest["macro_score"] is not None))

    def catch_up(self, now=None):
        now = local_time(now or self.clock())
        if now.time() >= time(7):
            return self.generate(now)
        return None, False


class MacroScheduler:
    """One lifecycle-managed thread per application worker; storage arbitrates races."""
    def __init__(self, service, retry_seconds=30):
        self.service = service
        self.retry_seconds = retry_seconds
        self.stop_event = threading.Event()
        self.thread = None

    def tick(self):
        try:
            return self.service.catch_up()
        except Exception:
            LOG.exception("Daily macro report generation failed; will retry")
            return None, False

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self.stop_event.clear()
        self.tick()  # Startup catch-up before serving requests.
        def run():
            while True:
                now = local_time(self.service.clock())
                due = datetime.combine(now.date(), time(7), tzinfo=BRISBANE)
                delay = min(self.retry_seconds, (due - now).total_seconds()) if now < due else self.retry_seconds
                if self.stop_event.wait(delay):
                    break
                self.tick()
        self.thread = threading.Thread(target=run, name="macro-daily-report", daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join()
