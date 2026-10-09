# System Health & Tools

The `/tools/` page presents a consolidated, read-only backend snapshot. It refreshes every 30 seconds, supports manual refresh, retains expanded panels and the activity filter, and removes current health claims after failed or expired observations. Times use Australia/Brisbane. It shares the site header and asset dialog; TOOLS is the fifth navigation button.

## Capability inventory

| Component | Evidence | Limit |
| --- | --- | --- |
| Public API and native 15m/1h/4h bots | Application checks, native status, process heartbeats | Application health is separate from container health |
| Universe scanner and ranking | Saved refresh, evaluated pool, version and Top 10 | Monitoring never triggers a scan |
| Universe synchronisation | Cached owning-bot acknowledgements | Missing/expired acknowledgements remain explicit |
| Market and derivatives | Worker activity, errors and per-asset freshness counts | A current collector does not make every asset current |
| Technical evidence and scoring | Saved decision-worker health and evidence coverage | Exact indicator/entry calculation times unavailable |
| Asset news | Source attempts/successes, empty checks, processed stories and mappings | Counts have different scopes; per-cycle end-to-end linkage is unavailable |
| Macro | Saved FRED report availability and report date | No fabricated current macro values |
| Events | Saved asset-event production | Reliable economic calendar unavailable |
| Risk and execution | Sizing-worker activity, execution-worker health and kill switch | Individual eligibility and exchange connectivity are separate |
| Positions and exits | Native status and owning bot exit records | Incomplete per-position exit coverage stays unknown |
| API services | Cached application GET-handler checks, response codes, duration | Duration is not network latency; no historical uptime claim |
| Activity | Saved worker/bot timestamps and actual monitoring checks | Observations do not imply state changes, fills or recovery |

The scanner, news classifier, market collector, decision, sizing, learning and paper reconciliation workers run within the public API. The public API, tunnel, three bots, legacy gate and administration are separate services. Docker state, uptime, CPU, memory and restart counts are unavailable to public monitoring. Independent tunnel and order-submission checks are unavailable. Private services and raw diagnostics remain private.

## Backend contract and deployment

`GET /api/v2/system/health` uses schema 1 and returns timestamp/expiry, overall status/explanation, service/intelligence/bot/pipeline cards, API observations, bounded activity and coverage gaps. Central collection has a 12-second deadline, per-probe in-flight suppression, and a 30-second cadence. Request handling only copies the snapshot. Public fields use explicit labels, numbers, validated dates and identities; raw exceptions, configuration and privileged logs are excluded. No Docker socket, administrative endpoint, database migration, trading callback or new dependency is introduced.

Overall OPERATIONAL requires complete evidence. Current monitoring cannot independently verify every entry/submission prerequisite, so it conservatively reports UNKNOWN or DEGRADED unless an actual central restriction establishes EXECUTION BLOCKED. Normal NO_GO is not an error. Bot process health is separate from entry readiness and capacity restrictions.

Backend source, tests, backups and guarded deployment instructions are held in the private workspace. Backend deployment is pending because NAS SSH access is refused. Until that deployment is independently verified, the published page reports monitoring unavailable. Publishing this repository does not deploy the API.

## Verification

`node tools.test.cjs` checks status rendering, safe text, failed refresh and expiry, retained panels/filter, 30-second polling, 12-second request timeout, GET-only access, five navigation buttons on all bot pages, and widths 320/375/768/1440. Local screenshots remain ignored. Existing bot-summary, universe and short technical-card suites pass. Backend deterministic checks cover worker freshness, missing heartbeats, offline/capacity/disabled execution, news failures and genuine empty results, acknowledgements, sanitization, read-only copies, timeouts and bounded in-flight checks. Runtime build/import and protected bot/run checks must also pass on the NAS before backend deployment is claimed.

No strategy, entry/exit equation, risk threshold, admission decision, universe algorithm, configuration, order, trade, balance, epoch or learning state was changed by this work.
