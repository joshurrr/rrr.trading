# Homepage intelligence overview

The homepage follows the monitored asset universe, grouped intelligence inputs, TradeRouter interpretation, and the three paper bots. Macro cards are compact; expandable observation dates and FRED sources, the saved full-report link, research evidence, report access, and existing bot routes remain available. Header, logo and sailing background are unchanged. The current bot pages already contain no duplicate asset price cards.

## Read-only data

- `/api/market-summary`: prices and absolute/percentage 24-hour moves.
- `/status`, `/api/demos/short/status`, `/api/demos/long/status`: configured universe and per-bot performance. Each response is requested once per market refresh and shared with the bot overview. Bot metrics require a current, matching PAPER/timeframe feed. Completed trade counts use existing full statistics for the medium bot.
- `/api/reports/macro/today` or the expected dated report before 7 am Brisbane: saved macro score, regime, evidence confidence, coverage and components. The full-report link follows the same reporting cycle. Stale snapshots are rejected; observation dates and stale-source labels remain available.
- `/api/research`, `/api/research/events/upcoming`, `/api/research/themes/latest`: existing themes and event renderers, with their source/coverage/stale states unchanged.
- `/api/trading-context`: fresh observation-only crypto regime and its evidence confidence. This is not an execution score or profit probability.
- `/api/demos/{short,medium,long}/decision-flow`: matching fresh diagnostics, recorded candidate context state and candidate timestamp. Original states such as PASS and FAIL-OPEN are preserved. A technical NO SIGNAL is labeled context not required only when no candidate context is retained. Final entry/order decisions are not substituted for context decisions.

There is no verified single global execution decision. Each bot remains identified in the context summary. Per-bot champion versions, eligible/restricted asset sets and structured event risk cannot be established from the mapped feeds and remain unavailable. A monitored whitelist does not establish trade eligibility. A shared policy champion is not assigned to individual bots. No new API fields or endpoints were added.

## Validation

`homepage.test.cjs`, `homepage-intelligence.test.cjs`, `market-summary.test.cjs`, `macro-rollover.test.cjs`, `research-themes.test.cjs`, and `catalysts.test.cjs` cover hierarchy, navigation, links, shared status requests, independent failures, recovery, wrong/stale feeds, zero/missing values, report rollover, evidence dates and responsive layouts. Screenshots are local ignored preview artifacts under `.runtime` and the temporary directory; test fixtures are not production readings.

Desktop/mobile layouts were inspected at 1440 and 375 pixels, with overflow assertions at 320, 375, 768, 1024, 1440 and 1920 pixels. Existing `shared-header.test.cjs` fails on a pre-existing demo title mismatch (`15min bot - Live demo` versus expected `15 min - Live bot demo`); neither file was changed. Homepage navigation and all three existing bot routes pass dedicated checks.

Only public frontend presentation and its documentation/tests change. No backend, trading logic, champion/challenger policy, bot configuration, database, paper balances/history or live execution state changes. Frontend publication is separate from NAS deployment.
