# Economic schedule — 9 October 2026

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

### Phase 2 requirements (not implemented)

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
