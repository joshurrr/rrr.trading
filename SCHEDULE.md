# Economic schedule — updated 10 October 2026

The forward-looking timetable redesign below supersedes the older Schedule panel
descriptions. Risk/protection diagnostics remain on their existing bot/Tools pages.
Economic protection Phase 4 adds a separately verified shadow policy presentation
on all three bot pages and the existing Tools calendar panel. Backend
source is prepared; NAS SSH refuses access and the new protection endpoints remain
404. The retained panels display protection unavailable while retaining deployed Phase 3
risk awareness. See [ECONOMIC_PROTECTION_PHASE4.md](ECONOMIC_PROTECTION_PHASE4.md)
for policy, verification, limitations and the distinction between an isolated
preview, frontend publication and production SHADOW deployment.

Current status: Economic Calendar Phase 2 is deployed and verified. The completed
private operator audit and independent public responses confirm
`economic-calendar-v2` / `economic-event-risk-v1`, informational-only true and
execution-connected false. The earlier prepared/404/Phase 1 observations in the
historical sections below are superseded. The verified snapshot's 30 HIGH / 14 timed /
16 date-only counts describe that audit only; current counts come from the API.
Private deployment evidence remains private. Phase 3 frontend integration is
described at the end of this document; its publication is verified separately.

The Schedule presents saved economic releases through GET `/api/schedule/economic`.
FRED is the primary source; its existing authentication and bounded transport are
shared with the daily macro pipeline. No browser credentials, new subscription,
trading callbacks or changes to `/api/reports/macro/today` are introduced. Future
schedules remain separate from historical observations and immutable macro reports.

| Announcement | FRED release | Historical context | Exact time supplement |
| --- | --- | --- | --- |
| Consumer Price Index / core CPI | [10](https://fred.stlouisfed.org/release?rid=10) | CPIAUCSL / CPILFESL, year-on-year percent change, seasonally adjusted | Official BLS ICS, matching release/date |
| Employment Situation: unemployment / nonfarm payrolls | [50](https://fred.stlouisfed.org/release?rid=50) | UNRATE percent / PAYEMS monthly change in thousands of persons | Official BLS ICS, matching release/date |
| Gross Domestic Product | [53](https://fred.stlouisfed.org/release?rid=53) | A191RL1Q225SBEA, quarterly annualized real growth | Official BEA ICS, matching release/date |
| Personal Income and Outlays: PCE / core PCE | [54](https://fred.stlouisfed.org/release?rid=54) | PCEPI / PCEPILFE, year-on-year percent change, seasonally adjusted | Official BEA ICS, matching release/date |
| Retail and food services sales | [9](https://fred.stlouisfed.org/release?rid=9) | RSAFS, millions of dollars, seasonally adjusted | Unavailable |
| Industrial production | [13](https://fred.stlouisfed.org/release?rid=13) | INDPRO, index 2017=100, seasonally adjusted | Unavailable |
| RBA Monetary Policy Board meeting concludes | [Official RBA calendar](https://www.rba.gov.au/schedules-events/board-meeting-schedules.html) | No fabricated previous policy value | Date confirmed; exact time unavailable |

Payrolls/unemployment share one announcement; PCE/core PCE share one announcement.
The previous values are latest revised historical context retrieved at refresh time,
not an original pre-release vintage or a verified prior headline print. Reporting
period, transformation, units, seasonal adjustment, source and retrieval time remain
visible. Missing/future/nonfinite observations remain unavailable. Old observations
are labeled stale (75 days monthly / 220 days for GDP quarter-start periods, allowing
for the following quarter's advance-release lag). This is historical-context
coverage, not an announcement timestamp or trading rule. No forecast is supplied;
every announcement displays **Forecast unavailable**.

FRED's [release dates API](https://fred.stlouisfed.org/docs/api/fred/release_dates.html)
uses `include_release_dates_with_no_data=true`, including scheduled future releases.
The attachment's longer parameter spelling is not the documented API parameter.
`/releases` supplies catalog metadata; `/releases/dates` is the aggregate alternative;
`/release/series` identifies constituent series. Verified release pages anchor the
selected mapping; production requests use `/release/dates` once per selected release
and `/series/observations` once per indicator, without duplicate catalog/date polling.

Official [BLS](https://www.bls.gov/schedule/) and
[BEA](https://www.bea.gov/news/schedule/icalendar) feeds supplement exact times only.
UTC and named Eastern timezone timestamps are converted to UTC on the backend and
Australia/Brisbane for display. Floating, conflicting, cancelled or unsupported
recurring times never become countdowns. Date-only records retain the agency date
and timezone rather than inventing a Brisbane midnight. RBA dates use its official
Monetary Policy Board column, separate from Payments System Board meetings.

Saved schedules refresh every six hours over a 90-day window and expire after 24
hours. Request-time expiry performs no collection or writes. Failed release refreshes
retain dated records as stale, without exact-time claims; healthy empty, unavailable,
partial and stale states differ. A provider-independent official adapter can be
extended later. Fed, ECB, Bank of England, Bank of Japan and broader international
statistics remain explicit coverage gaps; FRED international series alone do not
prove a policy announcement schedule. No paid source or credential was added.

Tools adds one collapsed economic-calendar coverage panel through GET
`/api/schedule/health`: FRED availability, full successful refresh, discovered releases,
verified timestamps, official-source errors, international refresh and gaps. This
does not change platform-health aggregation or trading-readiness claims.

## Verification and deployment status

Local browser suites: Schedule, Tools, shared navigation, trading universe and short
technical cards pass. Schedule includes loading/empty/404/503/timeout/malformed,
zero/stale/future/partial/unsafe text and links, no guessed time or forecast, GET-only
requests, expanded Tools panel preservation and 320/375/768/1440 widths. Screenshots
were reviewed locally under ignored `.runtime/schedule/`. The old navigation-only
placeholder expectation was updated to the new Schedule host; unrelated historical
fixtures retain their established limitations.

Private deterministic calendar tests and existing FRED/macro tests pass. Established
backend regression runner: 557 tests, 555 passed and two existing skips, retaining
the original platform/source exclusions. Backend source/tests/deployment guards
and evidence remain in the private workspace.

Real official-source preview verified BEA and RBA parsing. BLS returned HTTP 403
from the development environment; CPI/employment exact times must remain unavailable
unless its official feed succeeds on the NAS. No live FRED-key or scheduled FRED
calendar verification is claimed. NAS SSH refuses connections; the public calendar
endpoint is still 404. Backend source is prepared, **not deployed**. A private guarded
API-only package checks exact installed baselines, unrelated pending source changes,
actual image imports/tests, canonical runtime, protected bots/configuration, PAPER
epoch/identities, saved FRED evidence and source health before claiming integration.
Pending unrelated monitoring source changes are never silently included.

Frontend publication and live unavailable-state verification are separate from
backend deployment and recorded in the completion report. No bots, strategies,
risk controls, trading configuration, execution, statistics or learning were changed.
## Weekly lineup presentation — Phase 1 (9 October 2026)

The Schedule now uses a compact seven-day Monday-first timetable inspired by the
Radio RRR weekly lineup, with TradeRRR styling. Current Markets and Next High-Impact
Announcement panels precede the five columns: day, session, Brisbane time,
high-impact announcements and risk. Mobile day buttons collapse their rows;
announcement details use native keyboard-accessible details/summary controls.
Navigation, homepage and bot dashboards are unchanged. No backend files, API
contracts, collectors, trading controls or services are changed or restarted.

Files: `schedule/index.html`, `schedule/schedule.css`, `schedule/schedule.js`, new
`schedule/market-sessions.js`, `schedule.test.cjs`, `SCHEDULE.md` and `AGENTS.md`.
The site is static HTML/CSS/JavaScript; there is no frontend build/package step.

### Saved API and impact limitation

The page still calls only GET `https://api.rrr.trading/api/schedule/economic`, once
per refresh, with a 12-second timeout and 60-second polling. Its embedded health and
coverage fields supply the collapsed coverage information. The separate existing
GET `/api/schedule/health` remains owned by the unchanged Tools panel.

An independent read on 9 October returned schema 1 / fred-calendar-v1, status ok,
19 saved releases, a 9 October 2026–7 January 2027 source window and three verified
BEA timestamps. BLS times were unavailable; RBA records were date-only. This public
response supersedes the earlier endpoint-404 observation above. It is evidence of
public saved responses, not an audit of private backend deployment or source jobs.

Crucially, the response has **no impact classification**. All 19 releases are
therefore withheld from the high-impact lineup and next-event panel. The UI reports
"High-impact classification unavailable"; FRED inclusion, titles, release IDs and
previous observations never imply HIGH impact. Risk remains UNASSESSED without
supplied verified high-impact evidence; there is no event-risk calculation.

The frontend's dormant classification guard requires `impact: "HIGH"`,
`impact_verified: true` and an allowlisted HTTPS official `impact_source`. These
fields are not supplied by the deployed API. They are a conservative frontend
acceptance condition demonstrated only in fixtures, **not a newly implemented
backend contract or live classification integration**. A reviewed Phase 2 contract
and mapping are required before enabling live classification. Unknown, medium, low,
stale, past, malformed and unsupported records do not enter the lineup.

### Timezones, navigation and announcement placement

`market-sessions.js` uses Intl.DateTimeFormat / IANA rules for Australia/Brisbane,
Australia/Sydney, Asia/Tokyo, Europe/London and America/New_York. It solves regional
wall-clock times for each source weekday rather than hardcoding Brisbane offsets.
Tokyo 09–17, London 08–17 and New York 08–17 reuse `site-header.js`'s existing local
activity definitions. Sydney adds an explicitly indicative 08–17 local window.
These are regional business influence windows, not precise exchange sessions.
London represents Europe; instrument-specific continental exchange hours are not
claimed. No holidays, breaks or special opening hours are incorporated.

Full source intervals are clipped into each Brisbane date. London/New York
continuations appear at 00:00 on the next date, including Friday into Saturday,
with text explaining continuation. Multiple simultaneous active windows and the
current day have separate visual/text indicators. Status updates each second;
countdowns and date/week rendering update each minute. The default current-week
view follows the Brisbane Monday rollover. Crypto derivatives remain open 24/7,
including weekend rows; no crypto closure is inferred from regional downtime.

Week navigation filters the same saved response; it does not send unsupported
range parameters or make new calendar requests. Buttons are bounded to the supplied
window and disabled when the snapshot or its horizon cannot be verified. Partially
covered edge weeks are labeled. Current Week/Today remain available to return home.

Verified future timestamps require explicit VERIFIED status and an allowlisted
HTTPS official time source. They use the actual Brisbane date and corresponding
regional interval; releases outside that interval have their own regional row and
actual release time. Date-only evidence retains source date/timezone in a separate
regional section and is never assigned to a guessed Brisbane session/day. A source
date overlapping two Brisbane weeks can appear in each week's regional section,
with its original date preserved. Date-only records on the source's current day
cannot be established as upcoming and are withheld. No date-only countdown exists.
Next date-only evidence is ordered by source calendar date, explicitly without a
claim about exact release order. Snapshot/source failure or expiry removes current
event/countdown claims; active regional clocks remain independently indicative.

Expanded details preserve safe text and allowlisted HTTPS links, official sources,
verification, timestamps and revised historical context with units/periods. The
current API has no consensus forecast or original previous-release vintage; an
arbitrary numeric forecast is not trusted or displayed. Default rows omit historical
observations, retrieval times and internal identifiers. Expansion and keyboard focus
survive minute redraws; regional day controls retain their expansion during refresh.

### Phase 2 requirements recorded at Phase 1 completion (superseded below)

- Reviewed impact taxonomy, classification provenance/version and release-specific
  classifications; do not automatically label every FRED release HIGH.
- Reliable official timestamp verification for currently unsupported BLS releases
  and date-only policy meetings; preserve unknown timing rather than guessing.
- Fed, ECB, BoE, BoJ and broader global high-impact calendar coverage, with per-source
  health/freshness and honest completeness semantics.
- Optional date-range querying beyond the saved horizon and instrument-specific
  holiday/special-hours definitions if precise market openings are required.
- Genuine licensed consensus and prior-release vintages if those are to be shown.

Phase 1 stops at frontend presentation. Event-risk engines, bot integration, exits,
trading decisions and all Phase 2 backend implementation remain deferred.

### Phase 1 verification and publication

Local deterministic/browser checks passed: `schedule.test.cjs`,
`navigation-phase1.test.cjs`, `tools.test.cjs`, `trading-universe.test.cjs` and
`short-technical-cards.test.cjs`. The sole navigation-fixture change replaces its
old visible-FRED expectation with the requested new Schedule subtitle; other
navigation/dashboard expectations remain intact. Coverage includes all seven days,
Brisbane week/date rollover, northern/southern DST changes, half-open activity
boundaries, Friday/Saturday continuation, overlapping sessions, bounded navigation,
explicit HIGH/provenance filtering, past/unknown-time exclusion, source-date week
overlap, timed/outside-session placement, date-only next-event handling, countdowns,
keyboard details/day controls, focus/expansion preservation, stale/partial/empty/
outage/404/invalid/loading/timeout states, safe text/links, expiry and GET-only calls.
Widths 320/375/768/1440 passed; shared navigation also covers 1024/1920.

Clean local-source previews on the public origin (to match the existing CORS policy)
consumed actual saved public API responses: all 19 unclassified releases withheld,
90-day horizon, bounded next-week/Today navigation, coverage/source limitations,
seven days, no browser errors or API writes, and four widths passed. Synthetic HIGH
fixtures prove rendering paths only; they do not prove live HIGH-classification
availability. Desktop/mobile screenshots were reviewed under ignored
`.runtime/schedule-lineup/`. No dependency installation or frontend build is needed.
The historical unrelated homepage/bot regression limitations remain as documented;
no blanket legacy-suite or backend-test/deployment claim is made for this task.

Task-only commit/push, matching GitHub Pages workflow and independent live behavior
verification are recorded in the completion report, separately from these local
checks. No backend publication/restart is part of this phase.

## Global economic event intelligence — Phase 2, 10 October 2026

**Implemented and locally verified; backend deployment pending.** The current public
API still serves `fred-calendar-v1` without classifications and `/event-risk` is
404. SSH refuses NAS access. The compatible frontend is published separately and
continues withholding unclassified Phase 1 releases until the guarded API upgrade
is completed and independently verified. No trading bot is connected or restarted.

### Classification and provenance

The maintained backend taxonomy is `rrr-economic-impact-v1`. Exact source identity,
release ID and canonical announcement name must match a reviewed rule. HIGH is
RRR.Trading's internal assessment, not an agency/FRED trading-risk rating. The
agency URL supports announcement identity; schedule and time evidence are separate.
The frontend now requires HIGH, explicit verification, an allowlisted HTTPS identity
source, RRR.Trading ownership, this version, a recognised rule and a nonempty basis.
Cancelled, postponed, missing, stale and unclassified evidence remains excluded.
No broad keywords or automatic FRED membership classification is used.

| Rule | Announcement identity | Grouped statistics / scope |
| --- | --- | --- |
| us-cpi | BLS CPI, FRED 10 | CPI and core CPI |
| us-employment | BLS Employment Situation, FRED 50 | Payrolls and unemployment |
| us-gdp | BEA GDP, FRED 53 | Scheduled GDP estimates; not a result forecast |
| us-pce | BEA Personal Income and Outlays, FRED 54 | PCE and core PCE |
| au-policy | RBA Monetary Policy Board meeting end | Date-only meeting evidence |
| us-policy / eu-policy / jp-policy | Fed FOMC / ECB monetary meeting Day 2 / BoJ MPM end | Date-only meeting evidence; decision time unverified |
| uk-cpi / uk-gdp | Exact ONS inflation / first quarterly GDP release | Time-series companions excluded |
| au-cpi / au-employment / au-gdp | Exact ABS CPI / Labour Force / National Accounts | One announcement per release/date |
| uk-policy / uk-employment | Reviewed BoE MPC summary / ONS labour overview identities | Rules prepared; no working live BoE adapter or matching ONS employment overview established |

Retail sales (FRED 9), industrial production (13), ordinary statistics, monetary
minutes, forecasts and nonmatching titles remain UNKNOWN. A rule's existence alone
never creates an announcement: an actual official future calendar record is required.

### Providers and honest coverage

Existing FRED transport/authentication, BLS/BEA ICS and RBA table adapters are reused.
New bounded adapters consume the documented [ONS release search API](https://developer.ons.gov.uk/search/search-releases/),
structured [ABS release rows](https://www.abs.gov.au/release-calendar/future-releases),
and published [Fed](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm),
[ECB](https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html) and
[BoJ](https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm) meeting structures. HTML
adapters require explicit semantic structures and reject unsupported formats;
no historical-pattern scheduling, article scraping or paid provider is introduced.
ABS fetches the four relevant month pages at most for the 90-day window. ONS rejects
truncated responses, provisional times and malformed identities; original URI IDs
and date-change evidence survive revisions. Companion time-series releases are
excluded, rather than duplicating the main report.

Real development collection succeeded for BEA, RBA, Fed, ECB, BoJ, ONS and ABS.
BLS and BoE remain unavailable (403 observed in development); the BoE structured
parser is conservative and its actual format remains unverified. Eurostat's calendar
JSON returned no usable payload; Japanese statistics and China NBS have no verified
future-calendar adapters. Those gaps are documented, not invented events. ONS
returned no matching national labour overview in this window. Supported evidence
covers US, AU, UK, EU and JP, with incomplete categories in each region. Fed/ECB/BoJ
meeting dates do not establish a decision publication timestamp. There is no claim
of complete global coverage or live FRED-key collection during this task.

An **isolated preview** at 10 October 00:00 Brisbane combined existing saved public
FRED evidence with fresh official collection: **30 reviewed HIGH announcements,
14 verified HIGH times and 16 date-only HIGH records**. These are preview counts,
not production deployment counts. Production remains 19 saved Phase 1 releases,
three verified times and zero explicitly classified HIGH records at the initial
read. Passing fixtures and previews do not prove NAS provider access or deployment.

### Additive saved model and APIs

`schema_version: 1` and all existing legacy fields remain compatible. The collector
version becomes `economic-calendar-v2`. Added fields include `event_id`, `event_name`,
`event_category`, country/region/official agency, subcategories, impact ownership,
rule/version/basis, original source date/timezone, canonical UTC/time verification,
event/source statuses/checks/success times and affected market categories. Genuinely
unavailable values remain null. US reports retain their grouped historical context,
actual periods/units and existing revised-value caveats; macro reports are unchanged.

- GET `/api/schedule/economic`: existing saved lineup plus classifications and
  current-clock `event_risk`, `event_risk_version` and `risk_assessed_at`.
- GET `/api/schedule/health`: existing fields plus calendar status, classification
  version, HIGH/date-only/unclassified counts, snapshot age and country coverage.
- GET `/api/schedule/event-risk`: saved HIGH evidence, health/coverage, per-event
  state/time remaining, version/configuration, `informational_only: true` and
  `execution_connected: false`. No upstream I/O or writes on GET.

Risk states are SCHEDULED (>24h), APPROACHING (24h to >1h; elevated awareness within
4h), HIGH_ALERT (1h to >0), RELEASE_WINDOW (scheduled instant through 15m after),
POST_RELEASE_WINDOW (through 4h after), TIME_UNVERIFIED, DATA_STALE, UNKNOWN,
CANCELLED and evidence-confirmed COMPLETED. Passing the clock never proves actual
publication. Beyond the post-release window, unconfirmed events become UNKNOWN
and leave the recent-risk collection. COMPLETED requires an actual release timestamp
and an official confirmation reference; no result/confirmation collector is added.
Unknown timing produces null time remaining. Thresholds are positive bounded private
`ECONOMIC_EVENT_{APPROACHING,ELEVATED,HIGH_ALERT,RELEASE_WINDOW,POST_RELEASE}_SECONDS`
settings; invalid or misordered configuration fails closed. They are informational,
not entry vetoes, exits or position-sizing controls. Mixed unknown evidence is never
reported as no upcoming risk.

### Freshness, revisions and health

The existing six-hour worker, 90-day horizon and 24-hour expiry remain. Risk uses the
current request clock, so it does not wait for the next collection cycle. The UI
accepts risk evidence for at most two minutes, independently of calendar freshness.
UTC is canonical; IANA conversions preserve US/UK/European DST and Brisbane display.
Date-only evidence keeps its source date/timezone without a midnight countdown.

Exact IDs deduplicate polls. ONS URI IDs, explicit ABS reference-period identities and matching official ICS UIDs preserve
announcement identity across date changes; titles alone never merge releases.
Conflicting instants suspend time verification. Explicit cancellations are retained.
Disappeared records are retained as stale MISSING_FROM_SOURCE, not treated as cancelled
or proof of no risk. Recent prior-day records support post-release assessment.
Complete prior snapshots are archived privately before atomic latest replacement;
failed archival/storage suspends refresh claims. Existing audit history is retained.

Health separates OPERATIONAL, PARTIAL COVERAGE, STALE and UNAVAILABLE from FRED
transport and platform/trading readiness. Configured provider failures and unsupported
country/category coverage remain visible. Optional economic gaps do not change the
central platform aggregation. Tools adds counts/status to its existing compact panel;
it preserves old-backend compatibility and expanded-panel ownership.

### Verification, publication and private deployment

91 focused deterministic calendar/intelligence/isolation/FRED/macro tests pass
(21 existing calendar, 42 new intelligence, eight new isolation, eight existing
isolation and 12 FRED/macro). The established backend runner passed 557 tests:
555 passed and two existing skips, with prior platform/source exclusions retained.
Schedule, Tools, navigation, ranking and short technical browser suites pass.
Tools explicitly tests new counts, old-backend compatibility, stale/outage states
and independence from central platform health. The final private report records
these checks and deployment status. Browser tests retain 320/375/768/1440, safe
text/links, cancellation/date-only/unknown classification, expiry and GET-only
assertions. Real-source preview screenshots stay ignored under `.runtime/`.
Historical unrelated frontend regression limitations remain unchanged.

The separate private operator package checks the exact installed Phase 1 calendar,
all unchanged application/build inputs and protected runtime/configuration. It stages
an isolated context preserving the installed monitoring version, verifies pinned
image hashes/imports/tests and stopped canonical runtime, backs up persistent calendar
and intelligence evidence, and replaces only the public API. No source, credentials,
archives or deployment script belongs in this public repository. Canonical startup,
requirements, Dockerfile and exclusions remain unchanged; existing COPY *.py includes
the new top-level modules. Private operator/rollback instructions and full evidence
are in the secure workspace. Source preparation or frontend publication never proves
backend deployment. Verify all three public Schedule endpoints and rendered HIGH
events after the operator run before claiming completion.

Phase 2 ended with bot consumption deferred. The separately requested Phase 3 below
adds read-only frontend awareness. No strategies, entries/exits, stops, sizing,
universe selection, balances, positions, histories, statistics, paper epoch or
promotion settings are changed.

## Economic Phase 3 — shared risk awareness, 10 October 2026

`economic-event-risk.js` / `.css` supplies one reusable compact panel on the 15m,
1h and 4h dashboards and Schedule. It lives inside each existing bot summary, so
candidate layout cleanup leaves its ownership intact. No other feed owner changes.
One GET `/api/schedule/event-risk` per document refreshes every 60 seconds while
visible, with a 12-second timeout and no overlapping requests. One-second countdown
updates require no API requests. Hidden tabs suspend polling; returning tabs refresh.
Page teardown aborts requests and rejects obsolete results.

The panel renders the API's current risk state, a plain-language explanation,
supporting near-release evidence, the next eligible verified-time HIGH announcement,
country/source/Brisbane date-time/countdown, and a separate expandable collection of
date-only HIGH announcements with original source dates/timezones and **TIME NOT
VERIFIED**. Date-only announcements may precede the next verified release; no
cross-timezone release order is invented. Passing a scheduled time or source date
never confirms publication or assigns date-only evidence to a trading session.

Coverage displays saved evidence freshness, assessment time, saved refresh time,
calendar status, assessment sufficiency, failed official sources and documented
coverage gaps. Risk responses expire after two minutes independently of the saved
calendar's 24-hour expiry. Invalid/future/expired evidence, failed requests, malformed
responses or changed informational/execution flags suspend current claims and
countdowns. Last returned state/refresh metadata may remain explicitly unverified;
they are never displayed as current risk. UNKNOWN/TIME_UNVERIFIED/DATA_STALE explain
incomplete assessment. Partial coverage never means global safety or trading readiness.
Dynamic text uses text nodes; source links require official HTTPS hosts without
credentials. The internal Schedule link is fixed to `/schedule/`.

Schedule still uses GET `/api/schedule/economic`; Tools retains its existing GET
`/api/schedule/health`. Empty weekly rows now show **Outside calendar coverage** for
dates outside the saved window. Covered empty windows say **No matching HIGH-impact
events in the available calendar data**, qualified by partial global coverage and
the separate date-only collection. Missing/stale/classification evidence remains
unavailable; empty risk cells explicitly say **Risk unassessed**. Source-current and
older returned date-only records remain discoverable without claiming completion.
The coverage copy now accurately describes the deployed classification and shared
informational risk endpoint.

No backend changes, infrastructure duplication, NAS rebuilds or container restarts
are part of Phase 3. No event veto, forced exit, strategy, entry/exit, sizing, selection,
position, balance, statistics, PAPER control or learning change is introduced.
`informational_only=true` and `execution_connected=false` are required for rendering.
Economic enforcement remains deferred to a separate request.

Local verification: `economic-event-risk.test.cjs` and `schedule.test.cjs` cover
all three bots/Schedule at 320/375/768/1440, exact backend states/flags, Brisbane
conversion/countdowns, source-date boundaries, missing/expired/unverified times,
partial/stale/outage/404/malformed/timeout/loading/recovery, safe text/links and GET
requests only. Bot summary, current-run reporting, exit telemetry, diagnostics,
asset modal, navigation, Tools, ranking and short technical-card regressions pass.
`candidate-progress.test.cjs` retains an identical failure on untouched HEAD at its
old market-session heading assertion (line 120); the fixture remains unchanged.
Historical unrelated legacy limitations above remain. Screenshots and local logs
are ignored under `.runtime/economic-phase3/`; reviewed desktop/mobile panels wrap
within their viewport. Production publication evidence is recorded separately.

Publication verified 10 October 2026, 09:01 Brisbane: implementation commit
`12d94a4fb287689ae5ac2f1ea6a6512b88c23a3d` reached `origin/main`; matching
[Pages workflow 38002167629](https://github.com/joshurrr/rrr.trading/actions/runs/38002167629)
completed successfully and its github-pages deployment reports success. Published
shared JS/CSS and Schedule JS match source. Independent production browser checks
passed all three dashboards and Schedule at 320/375/768/1440, with actual backend
states/flags, Brisbane release time/countdown, date-only disclosures, partial
coverage/source gaps, corrected weekly labels, retained dashboard sections and
symbol dialog open/close. No page errors or non-GET public API requests occurred.
All panels displayed the actual TIME_UNVERIFIED / partial snapshot; the next
verified-time release was Labour Force, Australia. Those are verification-time
observations, not fixed production values. Local real-feed preview and published
production were checked separately. An initial live check began before Pages
finished and timed out; the completed-deployment rerun passed without source changes.
This is frontend publication verification, not another backend deployment.
## Forward-looking timetable redesign — 10 October 2026

The public Schedule presentation now starts on today's Australia/Brisbane date
and displays seven consecutive days, including Saturday and Sunday. Today and
Next 7 Days return to that rolling view; Next advances seven days and Previous
clamps to today. Future periods remain browsable during outages or beyond saved
announcement coverage, with explicit unavailable/outside-coverage labels.

Completed regional windows disappear, while currently active windows remain
highlighted together in cyan. Overnight windows retain their Brisbane-day clips.
The existing IANA session configuration remains authoritative; London represents
Europe and regional windows are indicative rather than holiday-adjusted exchange
hours. The initial view scrolls to an active or next session only when necessary;
automatic updates do not scroll the user. Brisbane midnight and tab restoration
revalidate the view. Future selections survive rollover until their start is past.

Only upcoming reviewed HIGH announcements enter the four-column timetable.
Passed verified timestamps and explicitly released/cancelled records are withheld.
Date-only evidence has a separate labelled row with its original source date and
timezone; placement indicates source-day overlap, not a verified Brisbane release
day or time. Older source dates are withheld without claiming confirmed publication.
Empty covered rows say "No upcoming high-impact announcements." Partial coverage,
unverified classifications, unavailable evidence and uncovered periods remain distinct.
Source links and fresh informational risk are available in compact event details.

Removed from Schedule only: Current Markets, Next High-Impact Announcement,
Economic Event Risk, Economic Protection Status, the separate risk column and the
technical coverage diagnostics. The existing hero/navigation remain unchanged.
Bots, Tools and shared diagnostic implementations remain intact. Desktop content
uses up to 1200px; mobile retains touch-friendly stacked rows and day disclosures.

The existing GET `/api/schedule/economic` reads a saved snapshot without date
parameters. Navigation does not fetch another range, so historical dates and
negative offsets are never sent to this endpoint. Delayed responses render the
current selection. No API contract, backend source, ingestion, economic intelligence,
risk protection, database, container or trading behaviour changes are included.

Focused browser coverage includes a non-Brisbane browser timezone, seven-day
navigation/clamping, refresh/delayed responses, exact release and session-close
boundaries, midnight with current/future selections, weekend continuation,
London/European/New York/Sydney DST, overlapping active rows, safe content/links,
classification/date-only/empty/stale/outage/timeout and 320/375/768/1440 layouts.
Local suites passed: `schedule.test.cjs`, `navigation-phase1.test.cjs`,
`tools.test.cjs`, `economic-event-risk.test.cjs`, `economic-protection.test.cjs`,
`trading-universe.test.cjs` and `short-technical-cards.test.cjs`. Shared-panel tests
now cover their retained bot/Tools owners; Schedule asserts panel absence. A local
source preview with the real saved public API passed date/navigation/active/upcoming,
four widths, manual-scroll preservation and GET-only/no-date-query checks without
page errors. Screenshots were reviewed under ignored `.runtime/schedule-forward/`.
Publication evidence is reported separately after the normal Pages workflow.

## Coverage repair candidate — 10 October 2026

See [ECONOMIC_CALENDAR_COVERAGE.md](ECONOMIC_CALENDAR_COVERAGE.md) for the source
audit, root causes, reviewed HIGH/MEDIUM rules and clearly labelled replay counts.
Backend deployment is pending operator execution because NAS SSH is refused.
Public source/rule allowlists accept the new reviewed records; the forward
seven-day timetable and date-only behaviour are unchanged. Frontend publication
does not deploy these private adapters or establish a production after-count.
