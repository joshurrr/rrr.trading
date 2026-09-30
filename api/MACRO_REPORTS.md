# Daily Macro Base Report v1

Backend only. No asset analysis, recommendations, trades, P/L or changes to
the existing asset scoring formula. The NAS sources are mirrored in `api/`
so the installed backend can be reviewed and tested in Git.

## Installed files

`macro_reports.py` contains provider validation, scoring, immutable JSON storage,
the latest-score helper and scheduler. `macro_routes.py` contains public routes
and lifecycle integration. `main.py` installs these using the existing Freqtrade
API username/password loaded from `/config/config.json`; the manual endpoint
uses HTTP Basic with those credentials. Config contents are never returned.
No new account or token store is created. CORS remains GET-only.

`Dockerfile` copies the report modules and `fred_macro.py`. The API requirements
already include `requests`; no new HTTP dependency is needed.
The NAS `build-and-run.sh` and `scripts/build-and-run.sh` now mount persistent
`/mnt/user/traderouter/data` as `/data`. Existing config and host networking
remain intact. Legacy `/api/health`, `/api/status`, `/api/score` and `/api/demo`
aliases coexist with `/health`, `/status`, `/score` and `/market-regime`.

## API

* `GET /api/reports/macro/today`: today's Brisbane snapshot, or 404 if missing.
* `GET /api/reports/macro`: `{reports: [...], latest: {...}}`, newest first.
  `latest` includes macro_score, report_date, confidence, regime, stale, available.
* `GET /api/reports/macro/YYYY-MM-DD`: immutable dated snapshot; invalid date
  returns 400, missing returns 404, unreadable snapshot returns 503.
* `POST /api/admin/reports/macro/generate`: authenticated generation for today's
  Brisbane date; returns `{created, report}`. Existing snapshots are returned
  unchanged. No force/overwrite option.

The snapshots themselves are immutable; staleness is calculated at request time
in the index's `latest` field and by `macro_reports.get_latest_macro_score()`.
Before 07:00 yesterday's snapshot is current. At/after 07:00 today's is required.
Missing snapshots are stale. `available=false` when the score is null; consumers
must check both flags rather than silently use old/incomplete evidence.

## Scoring and inputs

| Component | Weight | Live input |
|---|---:|---|
| rates | 20 | FRED DGS2 and DGS10 |
| usd | 15 | FRED DTWEXBGS |
| equities | 20 | FRED SP500 and NASDAQCOM |
| liquidity | 20 | FRED NFCI and WALCL |
| volatility | 15 | FRED VIXCLS |
| macro_events | 10 | unavailable |

`macro_score = round(sum(score_i * weight_i) / sum(available weights), 1)`.
Unavailable/stale/invalid inputs and zero-weight components do not contribute.
No available inputs means `macro_score=null`, regime `unavailable`, confidence 0.
Regimes: below 20 strongly risk-off; below 40 risk-off; below 60 neutral / mixed;
below 80 risk-on; otherwise strongly risk-on. The unrounded boundaries apply to
the reported one-decimal score.

Confidence is `sum(source_confidence_i * weight_i) / sum(all weights)`, rounded
to one decimal: source evidence confidence penalized by weighted missing coverage.
It is not a trading success probability. Configured/effective weights,
contributing components and coverage are stored with every snapshot.

FRED is the default source through the official
[observations API](https://fred.stlouisfed.org/docs/api/fred/series_observations.html).
There is no TradingView scraping, alternate price source, or synthetic value.
`macro_events` remains unavailable until a structured calendar is connected.
The existing example JSON represents the original unavailable snapshot;
historical snapshots remain immutable after connecting FRED.

Set `FRED_API_KEY` in the backend environment. Missing keys, upstream errors,
invalid data, insufficient comparison history, and stale data produce null scores.
All required series must be valid for a component to contribute. Other components
can still contribute when one fails. FRED's `.` missing marker is skipped when
selecting the latest valid observation; its actual date must pass freshness checks.
Malformed/nonfinite values and future observations fail closed.

Each build opens a new HTTP session and caches successes and failures by series
for that run only (eight normal requests). Requests use 3.05-second connect and
10-second read timeouts. Connection failures/timeouts and transient 5xx statuses
get one retry after 0.5 seconds. Client/authentication errors are not retried; a
429 stops further upstream calls for that run. Redirects are disabled. Logs contain
series IDs and safe diagnostics, never keys, upstream bodies or request URLs.
Sessions close after the build. Scheduler and manual generation share a worker
lock to avoid duplicate builds; cross-worker publication remains atomic.
Existing dated snapshots are returned without FRED calls.

For another source, pass `providers={component: callable}` to MacroReportService.
An explicit dictionary (including `{}` to disable upstream I/O) replaces defaults.
The callable takes a timezone-aware Brisbane datetime and returns score (0–100),
confidence (0–100), summary, an aware ISO source_timestamp, and nonempty HTTPS
source URLs. Normalize raw series in the adapter with documented methodology.
Custom providers retain the 36-hour default unless they implement
`validate_freshness(raw, now)`. FRED uses the policies below instead.

### Freshness and provenance

Ages are calculated from the observation date to the current **Brisbane calendar
date**. These are bounded tolerances rather than exact exchange/release calendars.
Weekends do not consume weekday allowance; extra weekdays allow holiday closures
and publication lag. Exceeding either limit makes the component unavailable.

| Series | Frequency | Maximum calendar age | Maximum weekdays elapsed |
|---|---|---:|---:|
| DGS2, DGS10, SP500, NASDAQCOM, VIXCLS | daily | 7 days | 3 |
| DTWEXBGS | daily observations / weekly publication | 10 days | 7 |
| NFCI | weekly | 14 days | n/a |
| WALCL | weekly | 10 days | n/a |

[DTWEXBGS](https://fred.stlouisfed.org/series/DTWEXBGS) uses H.10 releases;
daily observations arrive on a weekly schedule. Discontinued DTWEXB is not used.
[NFCI](https://fred.stlouisfed.org/series/NFCI) is a Friday-ending weekly index
released afterward. [WALCL](https://fred.stlouisfed.org/series/WALCL) is the weekly
Wednesday balance-sheet level. They need separate publication allowances.

Existing endpoints and fields are retained. Additive `components.*.provenance`
contains provider, method, retrieval/run time, and per-series raw values, actual
observation dates, source URLs, freshness policies/results, and comparison
dates/values. Rejected stale observations retain dates/values with `fresh=false`
and a null component score. Missing series are identified in the summary.
`source_timestamp` represents the oldest required observation date at Brisbane
midnight for compatibility; it is **not a publication timestamp**.
`scoring.fred_freshness` records policies. The existing
`scoring.max_input_age_hours=36` applies only to ordinary custom providers.

### Initial normalization (`fred_macro_v1`)

Scores are transparent heuristics, not FRED-provided scores or calibrated forecasts.
`clip(x)` bounds to 0–100. Daily trends compare the latest observation to the latest
valid observation on or before seven calendar days earlier, allowing at most four
additional days of baseline gap. WALCL uses 28 days with at most seven additional
days; never a daily price change. Missing baseline history makes the component
unavailable.

* Rates: average `clip(50 - 100 * yield_change_in_percentage_points)` for DGS2
  and DGS10. Falling yields score higher; this does not infer the cause of a move.
* USD: `clip(50 - 10 * percent_change)`; a stronger dollar scores lower.
* Equities: average `clip(50 + 10 * percent_change)` for SP500 and NASDAQCOM.
* Volatility: `clip(100 - 2.5 * VIXCLS)`; higher volatility scores lower.
* Liquidity: 75% `clip(50 - 25 * NFCI)` plus 25%
  `clip(50 + 10 * WALCL_28_day_percent_change)`. Positive NFCI means tighter than
  average and scores lower; negative NFCI means looser and scores higher. WALCL
  is a slower balance-sheet expansion/contraction signal, not net liquidity.

Each populated component gets heuristic evidence confidence of 80/100; this is
not an observed statistic or probability. Existing weights, coverage penalties,
and regime boundaries remain. Formula constants, confidence assumptions, and
freshness tolerances are explicit methodology choices for review.

## Schedule and persistence

FastAPI lifespan starts one background scheduler per worker and stops it on
shutdown while retaining any prior lifespan hooks. It checks the Brisbane clock
every 30 seconds, shortening the wait to reach 07:00. At/after 07:00 a missing
report is generated. Failed attempts are logged and retried. Every startup runs
this same check before serving requests, providing same-day catch-up. It does
not invent reports for past days when the service was offline.

Reports are `/data/reports/macro/YYYY-MM-DD.json`. A temporary file is flushed,
fsynced and closed, then published by an atomic **no-clobber hard link** on the
same filesystem. The directory is fsynced on Linux. Concurrent workers cannot
overwrite a winner. Temp files are removed; interrupted temp files are ignored
by the index. Unsupported hard links fail closed. Existing files are never
modified, even if unreadable, and API readers never see partial files.

## Docker rebuild/restart on NAS

Export `FRED_API_KEY` in the NAS shell environment first, or supply it through
your secret management. The script forwards the environment variable to Docker
without embedding its value. Never commit the key. Run this on the NAS shell;
the existing script includes the exact Docker build,
container replacement and run flags:

```bash
bash /mnt/user/traderouter/build-and-run.sh
docker logs --tail 100 traderouter-public
```

Equivalent explicit commands:

```bash
cd /mnt/user/traderouter/public_api
docker build -t traderouter-public:latest .
mkdir -p /mnt/user/traderouter/data
docker rm -f traderouter-public
docker run -d --name traderouter-public --restart unless-stopped --network host \
  -e FREQTRADE_URL=http://127.0.0.1:8080 \
  -e FREQTRADE_CONFIG=/config/config.json -e CACHE_SECONDS=5 -e DATA_DIR=/data \
  -e FRED_API_KEY \
  -v /mnt/user/traderouter/user_data/config.json:/config/config.json:ro \
  -v /mnt/user/traderouter/data:/data \
  traderouter-public:latest
```

## Curl

Use the existing Freqtrade API username; curl prompts for the password so it
does not appear in command history. From the NAS, use loopback:

```bash
curl --fail-with-body -u YOUR_EXISTING_API_USERNAME -X POST \
  http://127.0.0.1:8090/api/admin/reports/macro/generate
curl -fsS https://api.rrr.trading/api/reports/macro/today
curl -fsS https://api.rrr.trading/api/reports/macro
curl -fsS https://api.rrr.trading/api/reports/macro/2026-09-30
```

Run the regression checks after rebuilding:

```bash
for route in /health /status /score /market-regime /api/health /api/status /api/score /api/demo; do
  curl -fsS "http://127.0.0.1:8090$route" >/dev/null || exit 1
done
```

## Verification

`python -m unittest discover -s tests -v` exercises generation, weighting, gaps,
regimes, storage, concurrent duplicate prevention, atomic failure, catch-up,
restart, timezone boundaries, staleness, index, retrieval, invalid/missing dates,
authentication and actual NAS main.py legacy routes. Upstream Freqtrade HTTP is
mocked; these tests do not claim the running NAS container has been rebuilt.
FRED fixtures also cover all five adapters, normalization direction, frequency
freshness, holidays/weekends/publication lag, Brisbane timezone, missing markers,
malformed/future/stale observations, comparison gaps, missing keys, safe logs,
retries, rate limits, run caching, and concurrent generation without duplicate
requests. They make no live FRED requests.
Test dependencies: the API requirements plus `httpx==0.28.1`.
