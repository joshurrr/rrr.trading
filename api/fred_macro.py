"""FRED observations and explicit v1 macro normalization (see MACRO_REPORTS.md).

One instance per build: no cached observations survive into another report.
Observation dates are dates, not publication or retrieval timestamps.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
import logging
import math
import os
import time as timer
from zoneinfo import ZoneInfo

import requests

LOG = logging.getLogger(__name__)
BRISBANE = ZoneInfo("Australia/Brisbane")
ENDPOINT = "https://api.stlouisfed.org/fred/series/observations"
COMPONENTS = {
    "rates": ("DGS2", "DGS10"), "usd": ("DTWEXBGS",),
    "equities": ("SP500", "NASDAQCOM"), "volatility": ("VIXCLS",),
    "liquidity": ("NFCI", "WALCL"),
}


@dataclass(frozen=True)
class Freshness:
    frequency: str
    max_calendar_days: int
    max_weekdays: int | None = None

    def valid(self, observed, now):
        today = now.astimezone(BRISBANE).date()
        age = (today - observed).days
        if age < 0 or age > self.max_calendar_days:
            return False
        weekdays = sum((observed + timedelta(days=i)).weekday() < 5
                       for i in range(1, age + 1))
        return self.max_weekdays is None or weekdays <= self.max_weekdays

    def describe(self):
        return dict(frequency=self.frequency, max_calendar_days=self.max_calendar_days,
                    max_weekdays=self.max_weekdays, timezone="Australia/Brisbane")


# Bounded tolerances, including publication lag and holiday closures. H.10 is
# released weekly despite daily observations; NFCI is released after week-end.
POLICIES = {s: Freshness("daily", 7, 3)
            for s in ("DGS2", "DGS10", "SP500", "NASDAQCOM", "VIXCLS")}
POLICIES.update(DTWEXBGS=Freshness("daily", 10, 7),
                NFCI=Freshness("weekly", 14), WALCL=Freshness("weekly", 10))


class FredUnavailable(Exception):
    """Safe diagnostic: never includes request URLs or API keys."""


def clamp(value):
    return round(max(0, min(100, value)), 1)


class FredMacroRun:
    def __init__(self, session=None, api_key=None, sleep=timer.sleep):
        self.key = os.getenv("FRED_API_KEY", "").strip() if api_key is None else api_key
        self.session = session or requests.Session()
        self.sleep = sleep
        self.cache = {}
        self.rate_limited = False
        self.providers = {name: FredProvider(self, name) for name in COMPONENTS}

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.session.close()

    def observations(self, series, now):
        if series not in self.cache:
            try:
                self.cache[series] = self._fetch(series, now)
            except FredUnavailable as exc:
                self.cache[series] = exc
                LOG.warning("FRED %s unavailable: %s", series, exc)
        result = self.cache[series]
        if isinstance(result, FredUnavailable):
            raise result
        return result

    def _fetch(self, series, now):
        if not self.key:
            raise FredUnavailable("FRED_API_KEY is not configured")
        if self.rate_limited:
            raise FredUnavailable("FRED rate limit reached")
        today = now.astimezone(BRISBANE).date()
        params = dict(series_id=series, api_key=self.key, file_type="json",
                      sort_order="desc", limit=100,
                      observation_start=(today - timedelta(days=90)).isoformat(),
                      observation_end=today.isoformat())
        for attempt in range(2):
            try:
                response = self.session.get(ENDPOINT, params=params, timeout=(3.05, 10),
                                            allow_redirects=False)
            except (requests.Timeout, requests.ConnectionError):
                if attempt == 0:
                    LOG.info("Retrying FRED %s after transport failure", series)
                    self.sleep(.5)
                    continue
                raise FredUnavailable("FRED request timed out or could not connect") from None
            except requests.RequestException:
                raise FredUnavailable("FRED request failed") from None
            # Stop even when rate-limited on the second attempt.
            if response.status_code == 429:
                self.rate_limited = True
                raise FredUnavailable("FRED rate limit reached")
            if response.status_code in (500, 502, 503, 504) and attempt == 0:
                LOG.info("Retrying FRED %s after HTTP %s", series, response.status_code)
                self.sleep(.5)
                continue
            if response.status_code != 200:
                raise FredUnavailable(f"FRED returned HTTP {response.status_code}")
            try:
                body = response.json()
                rows = body["observations"]
                if not isinstance(rows, list):
                    raise ValueError()
                valid = {}
                for row in rows:
                    observed = date.fromisoformat(row["date"])
                    if observed > today:
                        raise FredUnavailable("FRED returned a future observation")
                    if row["value"] == ".":
                        continue  # FRED's explicit missing-value marker.
                    if not isinstance(row["value"], str):
                        raise ValueError()
                    value = float(row["value"])
                    if not math.isfinite(value) or (series != "NFCI" and value <= 0
                                                   and series not in ("DGS2", "DGS10")):
                        raise ValueError()
                    if observed in valid:
                        raise ValueError()
                    valid[observed] = value
                return sorted(valid.items(), reverse=True)
            except (ValueError, KeyError, TypeError, AttributeError):
                raise FredUnavailable("FRED returned malformed observations") from None
        raise FredUnavailable("FRED request failed")


class FredProvider:
    def __init__(self, run, name):
        self.run, self.name = run, name

    def validate_freshness(self, raw, now):
        entries = raw.get("provenance", {}).get("observations", [])
        return (set(e["series_id"] for e in entries) == set(COMPONENTS[self.name])
                and all(POLICIES[e["series_id"]].valid(date.fromisoformat(e["observation_date"]), now)
                        for e in entries))

    def __call__(self, now):
        entries, latest, baselines, problems = [], {}, {}, []
        for series in COMPONENTS[self.name]:
            try:
                rows = self.run.observations(series, now)
                if not rows:
                    raise FredUnavailable("No valid observations")
                observed, value = rows[0]
                policy = POLICIES[series]
                entry = dict(series_id=series, value=value, observation_date=observed.isoformat(),
                             source=f"https://fred.stlouisfed.org/series/{series}",
                             freshness=policy.describe(), fresh=policy.valid(observed, now))
                entries.append(entry)
                latest[series] = value
                if not entry["fresh"]:
                    raise FredUnavailable(f"Latest observation {observed} is stale")
                if self.name in ("rates", "usd", "equities") or series == "WALCL":
                    # Calendar-anchored baseline, with a bounded gap. Do not silently
                    # pick arbitrary older history when the target window is missing.
                    days = 28 if series == "WALCL" else 7
                    target = observed - timedelta(days=days)
                    baseline = next(((d, v) for d, v in rows[1:] if d <= target), None)
                    if baseline is None or (target - baseline[0]).days > (7 if series == "WALCL" else 4):
                        raise FredUnavailable("Comparison history is missing or too old")
                    baselines[series] = baseline[1]
                    entry["comparison"] = dict(observation_date=baseline[0].isoformat(), value=baseline[1])
            except FredUnavailable as exc:
                problems.append(f"{series}: {exc}")
        provenance = dict(provider="FRED", method="fred_macro_v1",
                          observations=entries, retrieved_at=now.isoformat())
        if problems:
            return dict(score=None, confidence=0, status="unavailable", summary="; ".join(problems),
                        source_timestamp=None, sources=[e["source"] for e in entries], provenance=provenance)
        def pct(s):
            if baselines[s] <= 0:
                raise FredUnavailable("Comparison value must be positive")
            return 100 * (latest[s] / baselines[s] - 1)
        try:
            if self.name == "rates":
                score = sum(clamp(50 - 100 * (latest[s] - baselines[s])) for s in latest) / 2
            elif self.name == "usd":
                score = clamp(50 - 10 * pct("DTWEXBGS"))
            elif self.name == "equities":
                score = sum(clamp(50 + 10 * pct(s)) for s in latest) / 2
            elif self.name == "volatility":
                score = clamp(100 - 2.5 * latest["VIXCLS"])
            else:
                score = .75 * clamp(50 - 25 * latest["NFCI"]) + .25 * clamp(50 + 10 * pct("WALCL"))
        except FredUnavailable as exc:
            return dict(score=None, confidence=0, status="unavailable", summary=str(exc),
                        source_timestamp=None, sources=[e["source"] for e in entries], provenance=provenance)
        details = "; ".join(f"{e['series_id']}={e['value']:g} (observed {e['observation_date']})" for e in entries)
        if self.name == "liquidity":
            interpretation = "tighter" if latest["NFCI"] > 0 else "looser" if latest["NFCI"] < 0 else "at average"
            details += f"; NFCI conditions {interpretation}; WALCL is a weekly balance-sheet input"
        # Date-only source represented at Brisbane midnight for compatibility.
        oldest = min(date.fromisoformat(e["observation_date"]) for e in entries)
        return dict(score=round(score, 1), confidence=80, summary=details,
                    source_timestamp=datetime.combine(oldest, time(), BRISBANE).isoformat(),
                    sources=[e["source"] for e in entries], provenance=provenance)
