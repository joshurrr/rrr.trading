# System Health & Tools

The `/tools/` page presents a consolidated, read-only backend snapshot. It refreshes every 30 seconds, supports manual refresh, retains expanded panels and the activity filter, and removes current health claims after failed or expired observations. Times use Australia/Brisbane. It shares the site header and asset dialog; TOOLS is the fourth primary navigation button, after Live Analysis, Schedule and Trading Bots.

## Capability inventory

| Component | Evidence | Limit |
| --- | --- | --- |
| Public API and native 15m/1h/4h bots | Application checks, native status, process heartbeats | Application health is separate from container health |
| Universe scanner and ranking | Saved refresh, evaluated pool, version and Top 10 | Monitoring never triggers a scan |
| Universe synchronisation | Native saved acknowledgements and existing checked cache | 120s acknowledgement window; expired cache alone is not a verified mismatch |
| Market and derivatives | Worker activity, errors and per-asset freshness counts | A current collector does not make every asset current |
| Technical evidence and scoring | Current native closed candles, finite EMA/RSI/MACD values, independent decision-worker activity | Native candle coverage and v2 decision coverage are separate; exact calculation times are not retained |
| Asset news | Source attempts/successes, empty checks, processed stories and mappings | Counts have different scopes; per-cycle end-to-end linkage is unavailable |
| Macro | Saved FRED report availability and report date | No fabricated current macro values |
| Events | Saved asset-event production | Reliable economic calendar unavailable |
| Risk and execution | Sizing-worker activity, execution-worker health and kill switch | Individual eligibility and exchange connectivity are separate |
| Positions and exits | Native status and owning bot exit records | Incomplete per-position exit coverage stays unknown |
| API services | Cached application GET-handler checks, response codes, duration | Duration is not network latency; no historical uptime claim |
| Important events | Observed status/restriction changes, universe versions/acknowledgements and completed news cycles | Bounded process-local history; no fabricated pre-start history or every-check success events |

The scanner, news classifier, market collector, decision, sizing, learning and paper reconciliation workers run within the public API. The public API, tunnel, three bots, legacy gate and administration are separate services. Docker state, uptime, CPU, memory and restart counts are unavailable to public monitoring. Independent tunnel and order-submission checks are unavailable. Private services and raw diagnostics remain private.

## Backend contract and deployment

`GET /api/v2/system/health` uses schema 1 and returns timestamp/expiry, overall status/explanation, service/intelligence/bot/pipeline cards, API observations, bounded activity and coverage gaps. Central collection has a 12-second deadline, per-probe in-flight suppression, and a 30-second cadence. Request handling only copies the snapshot. Public fields use explicit labels, numbers, validated dates and identities; raw exceptions, configuration and privileged logs are excluded. No Docker socket, administrative endpoint, database migration, trading callback or new dependency is introduced.

The refinement separates core platform status, execution readiness and monitoring coverage. OPERATIONAL describes verified required platform processing with no detected critical execution failure; it does not approve an entry. Missing critical observations prevent OPERATIONAL; missing per-candidate entry eligibility remains explicitly NOT VERIFIED in execution readiness. Confirmed outages take precedence, global execution disablement is EXECUTION BLOCKED, and active required/supporting degradation remains DEGRADED. Local capacity restrictions affect only their owning bot. Normal NO_GO and no native signal are not failures.

Backend source, tests, backups and guarded deployment instructions are held in the private workspace. Backend deployment completed on 9 October 2026 through the guarded operator resume after an interrupted terminal session. Actual image hashes/imports, offline regressions and 34 focused monitoring/exit tests, unchanged protected bots/configuration, PAPER epoch and database integrity passed. Independent public checks confirm a current advancing snapshot and all three native bots RUNNING/PAPER with the existing run. Publishing this repository remains separate from API deployment. The live dashboard currently reports DEGRADED for incomplete technical coverage, delayed asset evidence and partial news sources; this is distinct from deployment failure. Individual entry readiness and unsupported metrics remain honest UNKNOWN/unavailable states.

## Verification

`node tools.test.cjs` checks status rendering, safe text, failed refresh and expiry, retained panels/filter, 30-second polling, 12-second request timeout, GET-only access, four primary navigation buttons on all bot pages, and widths 320/375/768/1440. Local screenshots remain ignored. Existing bot-summary, universe and short technical-card suites pass. Backend deterministic checks cover worker freshness, missing heartbeats, offline/capacity/disabled execution, news failures and genuine empty results, acknowledgements, sanitization, read-only copies, timeouts and bounded in-flight checks. Runtime build/import and protected bot/run checks must also pass on the NAS before backend deployment is claimed.

No strategy, entry/exit equation, risk threshold, admission decision, universe algorithm, configuration, order, trade, balance, epoch or learning state was changed by this work.

## Health accuracy refinement — 9 October 2026

The initial audit found 93 insufficient v2 decision records (the screenshot had 98), while all three native feeds exposed recent RSI/MACD observations. That count did not establish failed indicator processing. Direct native candle checks now assess each bot's current candidate set independently. The audited 4h feed had missing EMA values on one candidate; that genuine gap remains degraded. Exact indicator calculation time is not inferred from candle time.

The 17 news errors were active per-asset discovery-source failures, not simply old lifetime errors. The saved classifier was completing and producing asset mappings. Current source failures remain warnings; old source errors cannot permanently degrade a subsequently verified fresh collection. `stories_processed` counts normalized input records in the latest saved-feed classification cycle, including replay; duplicates and produced mappings have separate scopes. Newly discovered articles, assets checked and exact per-cycle incorporation into decisions remain unavailable where not recorded. Zero relevant results from a successful source are valid.

Native acknowledgement evidence is reused without an extra bot request. Fresh native acknowledgements are checked against the current version, approved pairs and existing native whitelist. A recent existing cached check also remains usable; matching expired cache is NOT VERIFIED. A new universe gets a 120s monitoring confirmation window; an observed mismatch after that window remains DEGRADED. This monitoring allowance changes no trading synchronisation rules.

The main page retains four service cards and eight intelligence cards. Tunnel, private gate/admin and inactive economic-calendar cards are removed from the main presentation. Six compact pipeline stages retain separate candidate/sizing/admission/order/position/exit observations in details. API checks become an expandable summary explicitly labeled handler execution duration. Bot cards show process, indicator coverage, universe, strategy, mode, native evaluation, central admission verification and observed capacity. Native no-signal evidence does not establish central READY/WAITING.

Issues are grouped as CRITICAL, WARNING and MONITORING GAP, with observed detection times and links to details. Optional Docker metrics are not issues. Events retain the latest 20 meaningful observed changes/completions, deduplicate unchanged checks and start with the monitor process; first detection is monitoring observation time, not an invented historical onset.

Local verification: 52 focused monitoring tests pass; the established backend runner passes 557 tests with two existing skips and unchanged platform/source exclusions. Dashboard, bot-summary, universe, technical-card and navigation browser suites pass, including safe text, issue links, API expansion, old-backend compatibility, 30s polling, 12s timeout, missing/expired/stale evidence and 320/375/768/1440 layouts. Screenshots remain ignored. A local real-feed classification preview is not a production deployment.

Backend refinement deployment remains pending because SSH access is refused. The guarded API-only deployment and exact installed-source baseline are prepared in the secure workspace; no bots have been restarted or controls changed. The frontend supports the existing deployed schema while clearly stating that refined issue classification awaits the backend update. Frontend publication and successful Pages/live checks must be verified separately. Full central entry eligibility, joined per-cycle news-to-decision evidence, independent exchange connectivity and persistent monitoring history remain limitations.
