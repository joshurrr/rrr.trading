# Economic calendar coverage repair — 10 October 2026

Backend repair is prepared and tested, **not deployed**. The NAS SSH connection
was refused. Frontend compatibility publication is separate from backend
deployment. Production still serves the original calendar until the guarded
operator deployment and independent API audit succeed.

## Root causes and pipeline evidence

The captured production response contained 36 saved announcements. For
10–16 October in the Brisbane timetable it contained four valid announcements:
CPI, Australian Labour Force, Retail Sales and Industrial Production. Only the
first two had reviewed HIGH classifications. The HIGH-only frontend filter was
working correctly for those records.

Confirmed collection defects:

- FRED's selected releases omitted PPI (release 46) and Import/Export Prices
  (release 188). The existing authenticated FRED transport is reused.
- ONS's exact-title filter excluded monthly GDP and the actual `UK Labour Market`
  umbrella title. In the captured 30-day payload, 76 raw records yielded one
  supported headline with the old parser and three with the repaired parser.
  Companion time-series/regional releases remain excluded.
- Eurostat and Japanese statistical calendars had no adapters. Eurostat's
  official calendar uses a public structured JSON feed; the captured payload had
  25 raw entries, seven supported headlines, five inside the audited 30 days.
- The BoE parser expected a table caption although the official page uses a
  confirmed-year heading. This parsing defect is fixed, but HTTP 403 still
  prevents collection from that page.
- Successful BLS/BEA evidence was discarded when its corresponding FRED request
  failed. A source-labelled official fallback now preserves that evidence while
  retaining the FRED failure in health.
- A failed refresh could be attempted every minute. The existing scheduler now
  backs off 5, 10, 20, 40 and then 60 minutes after exceptional failures. Successful
  refreshes retain the six-hour cadence, 90-day lookahead and 24-hour expiry.

Classification defects: Retail Sales and Industrial Production were unreviewed.
Retail Sales is now HIGH; Industrial Production is MEDIUM. New rules have explicit
internal rationale and additive revision `2026-10-10-coverage-1`; the existing
`rrr-economic-impact-v1`, `economic-calendar-v2` and schema version 1 remain.
Official agencies verify identity/schedule, not RRR.Trading's impact judgement.

The frontend also has an explicit recognised-rule/source allowlist. Its small
compatibility update is necessary to display the new valid HIGH records. No
layout, dashboard panel or navigation redesign is included.

Original upstream raw FRED counts were not saved, so they cannot be reconstructed
honestly. The pipeline baseline establishes saved 36 → seven-day valid 4 → HIGH
2 → public eligible 2. The repaired collector adds raw FRED/structured-provider,
normalised and saved-record counts for future diagnostics. Raw records include
companion/unsupported records and are not all distinct supported announcements.

## Source audit: 10 October–8 November 2026

| Source | Evidence and status |
|---|---|
| FRED | Working existing integration; PPI/Import-Export selection prepared. New authenticated requests require NAS deployment verification. Dates do not verify times. |
| BLS | Unavailable: one bounded request to ICS and one to annual HTML each returned 403. FRED provides legitimate date fallback; BLS remains unavailable. |
| BEA | Working official ICS; exact matching release/date timestamps only. Official evidence is retained independently of failed FRED requests. |
| Federal Reserve | Working FOMC meeting-end dates; 28 October date-only. |
| RBA | Working meeting-end dates; 3 November date-only. |
| ABS | Working timed Labour Force 15 October and CPI 28 October. No GDP release established inside this 30-day window. |
| ECB | Working policy meeting-end date 29 October, time unverified. |
| BoJ | Working policy meeting-end date 30 October, time unverified. |
| BoE | Unavailable: upcoming-calendar and official annual-announcement requests both returned 403. Official page lists 5 November, but the collector cannot claim current acquired evidence or verified time. |
| ONS | Working; monthly GDP 15 October, labour-market umbrella 20 October, CPI 21 October. UTC timestamps convert through Europe/London. |
| Eurostat | Working captured official feed: industrial production 15 October MEDIUM; HICP 16 October HIGH; initial GDP 30 October HIGH; unemployment 30 October MEDIUM; flash inflation 4 November HIGH. All captured records are `allDay`, so embedded timestamps do not become verified release times. |
| Statistics Bureau of Japan | Working national CPI 23 October HIGH and basic labour survey 30 October MEDIUM, dates only. Tokyo-only CPI and detailed labour companions excluded. |
| Japan Cabinet Office / ESRI | Working explicit initial GDP schedule; next release 16 November 08:50 JST, outside the 30-day audit, inside normal 90-day collection. Second-estimate companions excluded from this headline adapter. |
| China NBS | Official annual table reachable, but it explicitly labels dates preliminary. GDP/national economic performance, CPI/PPI and PMI remain an honest confirmed-schedule coverage gap. No speculative records or customary times added. |

Working means captured official evidence parsed successfully, not proof of
production integration. Calendar coverage remains PARTIAL.

## Seven-day comparison

Same window: **10–16 October 2026 Brisbane**. Verified instants use Brisbane dates;
date-only records retain their labelled source-local dates. The frontend marks
source-day overlap rather than inventing a Brisbane release date/time.

| Stage/count | Captured production | Repaired captured-evidence replay |
|---|---:|---:|
| Valid saved announcements in window | 4 | 7 |
| Reviewed HIGH | 2 | 5 |
| Verified-time HIGH | 1 | 2 |
| Date-only HIGH | 1 | 3 |
| MEDIUM | 0 | 2 |
| UNKNOWN/unassessed | 2 | 0 |
| Historical upstream raw discovery count | Not recorded | Not comparable |

The replay uses captured official payloads and existing saved FRED evidence; it
is **not an authenticated refresh or a production after-count**. PPI and
Import/Export Prices are deliberately absent from these replay counts because
their new authenticated FRED requests have not run. Deployment saves actual
before/after API evidence and independently checks the public response.

## Investigated missing releases

- **PPI:** BLS's official 2026 calendar schedules 15 October, 08:30 US Eastern.
  Missing release selection repaired; reviewed HIGH. With BLS blocked, FRED
  establishes a date only. Do not copy the researched official HTML time into
  a production verified timestamp without acquired event-specific evidence.
- **UK monthly GDP:** official ONS record schedules 15 October 06:00 UTC
  (07:00 BST / 16:00 Brisbane). Parser repaired; reviewed HIGH; appears in replay.
- **Import/Export Prices:** BLS schedules 16 October, 08:30 US Eastern. Selection
  repaired using FRED release **188**; reviewed MEDIUM and excluded from the HIGH
  timetable. No production timestamp is invented while BLS is unavailable.
- **Retail Sales:** already saved for 15 October; now reviewed HIGH, date-only.
- **Industrial Production:** already saved for 16 October; reviewed MEDIUM,
  retained in API diagnostics and excluded from the HIGH timetable.

Evidence: [BLS 2026 release calendar](https://www.bls.gov/schedule/2026/home.htm),
[FRED PPI release 46](https://fred.stlouisfed.org/release?rid=46),
[FRED Import/Export release 188](https://fred.stlouisfed.org/release?rid=188),
[ONS monthly GDP](https://www.ons.gov.uk/releases/gdpmonthlyestimateukaugust2026),
[Eurostat official calendar](https://ec.europa.eu/eurostat/news/euro-indicators/release-calendar),
[Japan CPI schedule](https://www.stat.go.jp/english/data/cpi/1582.htm),
[Japan labour schedule](https://www.stat.go.jp/english/data/roudou/1543.htm),
[Japan GDP schedule](https://www.esri.cao.go.jp/en/sna/kouhyou/kouhyou_top.html),
[NBS annual calendar](https://www.stats.gov.cn/english/PressRelease/ReleaseCalendar/202512/t20251226_1962154.html).

## Files, verification and safety

Private candidate changes are limited to `economic_calendar.py` (selection,
fallback, refresh and health), `economic_calendar_providers.py` (strict adapters
and identities), and `economic_event_intelligence.py` (reviewed classifications).
Private deterministic tests, audit/replay evidence and guarded deployment/rollback
files remain outside this public repository. The candidate reconstructs the exact
93-input installed Phase 4 image; only those three modules differ. Pending Phase 5
and monitoring drafts are preserved and excluded from the image.

Public changes: Schedule and shared risk source/rule allowlists, script cache
versions on Schedule/three bot pages, Schedule/risk fixtures and documentation.
The shared risk panel remains read-only and requires the same API flags/states.

Focused private verification covers calendar/FRED/risk/protection regressions,
new adapters, cancellations, postponements, time verification, deduplication,
legacy ONS identities, revised dates, API compatibility, no writes on GET,
bounded backoff and fail-closed package guards. Frontend verification covers
320/375/768/1440, midnight/DST/navigation, active sessions, multiple regions,
date-only/new HIGH records, MEDIUM exclusions and unavailable/stale handling.
Final local results: **163 private tests passed**, with no failures or skips in
the focused run. Seven frontend suites passed: Schedule, economic-event-risk,
economic-protection, Tools, navigation-phase1, trading-universe and
short-technical-cards. A local source preview using the real saved API also
passed four widths, active/upcoming/date/navigation checks and GET-only requests,
with no page errors. Screenshots were reviewed locally. These are focused checks,
not a claim that all historical project suites pass. Frontend publication evidence
is recorded in the task completion report; actual Docker builds/imports/offline tests remain operator
deployment steps, not local Windows test claims.

Protection config, eligibility allowlist, thresholds, windows and recovery remain
unchanged. All new HIGH rules are excluded from the existing systemic protection
rules; tests assert no new protection windows, enforcement or automatic exits.
The `assess` and `thresholds` function bodies are unchanged. Every other installed
module, including all protection/execution modules, is pinned unchanged.

No trading bot restart, strategy/configuration/sizing/selection changes, order or
position mutation, statistics reset, database rebuild, PAPER epoch reset or
learning change was performed. The sampled public protection API remains SHADOW,
execution disconnected, automatic economic exits zero. Positions continue under
the existing bots; no post-deployment persistence claim is made before deployment.

The guarded operator workflow verifies installed source, backs up calendar,
policy and consistent databases, builds/imports/tests the isolated image, checks
canonical stopped runtime and protected bot fingerprints, replaces only the API,
and checks PAPER/identity/history/policy persistence plus independent public
calendar/SHADOW endpoints. Rollback restores only the prior API image; it never
restores or resets native trading databases.
