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
are labeled stale (75 days monthly / 150 days quarterly). No forecast is supplied;
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
