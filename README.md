# RRR Trading

Systematic medium-term trading platform, powered by **TradeRouter**.

## v0.1
- Static GitHub Pages front end
- Paper-mode dashboard concept
- Market candidate scoring UI
- TradeRouter event log concept
- No live trading or exchange connectivity yet

Custom domain: https://rrr.trading

## Homepage and public demo

The static homepage uses `https://api.rrr.trading/api/market-summary`, `/market-regime`
and the saved daily Macro report with no-store requests, 10-second timeouts and a 30-second
refresh after requests complete. Hidden tabs skip polling. Endpoint failures
clear the affected panel without hiding other available data.

`demo/index.html` serves the public `/demo` route from the repository root.
`website/demo/index.html` is the original reference copy; deploy the root site.
Trading configuration remains in the private NAS workspace. Frontend changes
do not deploy the API or restart Freqtrade.

The Reports page hides the sample fragment and archive links, and shows a concise
empty state until the repository-controlled fragment is marked
`data-report-kind="published"`. The report fragment and sample archive files remain
in place as infrastructure. Unsupported homepage signals and assessment rows stay
hidden; existing market regime and conviction values remain unchanged.
The homepage paper summary reads the three existing public demo feeds, rejects
stale or mismatched feeds, and displays only available status, P/L and open counts.
No trading calculations or backend changes are part of this presentation update.

Validation: serve the root with `python -m http.server 8765`, then run
`node homepage.test.cjs` with Playwright installed and Microsoft Edge available.
The browser test intercepts API requests with test-only fixtures and checks
responsive widths, missing values, partial and complete API outages, navigation,
report loading and empty states, radio defaults and `/demo` routing.
Screenshots are written to the OS temporary directory.

Deployment follow-up: `/status`, `/score` and `/market-regime` returned HTTP 404
when checked on 30 September 2026. Restore those public routes and verify CORS
allows `https://rrr.trading` before expecting current data to appear.

## Shared public header

`site-header.js` owns the logo, navigation, mobile menu and opt-in Radio RRR
player; `site-header.css` scopes its appearance across the public pages.
Daily macro reports appear on the homepage; archived examples are unlinked. The Demo menu
links to `/demo/short/` (15 Min), `/demo/` (1 Hour), and `/demo/4hrbot/` (4 Hour).
About is a standalone `/about.html` page with the shared header, radio and footer.
Archived example pages remain available directly but are not linked from the main navigation.

For a future top-level page, load `/site-header.css` and the deferred
`/site-header.js`, place `<div data-site-header></div>` before
`<main id="main">`, and set `data-page` on the body to its navigation key.
Add new navigation entries once in `site-header.js`. The header requires
JavaScript, as does the live demo. Radio never autoplays; full page navigation
stops playback and requires another press of Play.

## Demo macro and asset analysis

The homepage Asset Analysis renderer now lives in `demo/assets.js`, with its
existing card rules scoped in `demo/assets.css`. BTC, ETH, SOL, XRP, LINK, ONDO, AAVE, UNI, HYPE and INJ appear
below trade history in a collapsible Asset Analysis section, closed by default.
Model trend/conviction fields use `/score`; USD prices and 24-hour changes use
the existing `/api/market-summary` Kraken feed. Missing model fields remain
awaiting analysis. Exchange observations older than 120 seconds are unavailable.

The Macro section uses `/api/reports/macro/today` and the API's original
0�100 score and regime. Reports must match today's Brisbane date; stale or
missing reports show N/A. Scores and Macro retry every 30 seconds, exchange
prices every 60 seconds, and the original status refresh remains 15 seconds.
There is no new frontend macro calculation.

Validation: run `node demo.test.cjs`, `node homepage.test.cjs`,
`node market-summary.test.cjs` and `node shared-header.test.cjs` with the root
served on port 8765. Tests use explicit fixtures, including failures and stale
data, and save screenshots to the OS temporary directory. Fixtures do not
verify production data availability.

## Short Term 15m demo

`/demo/short/` is a separate Bybit USDT perpetual paper dashboard. It polls
only `https://api.rrr.trading/api/demos/short/status`, with a 15-second refresh.
It shows long/short direction, per-position leverage, USDT amounts, realised
P/L, open positions and trade history. Missing, stale (over 30 seconds), live
or mismatched bot feeds are unavailable; the medium feed is never substituted.
The shared Demo dropdown switches between the two pages.

Strategy, private credentials, persistent database and bot installation remain
in the NAS workspace. Publishing this frontend does not start the short bot.
Validate with `node short-demo.test.cjs` and `node shared-header.test.cjs` while
serving the repository on port 8765. Test fixtures are not live trading results.

Phase 1: both demo pages show the actual scanned futures pair list from their own
status feed. Trade direction is read from each trade. Frontend changes are local
until separately published to GitHub Pages; NAS deployment uses the private
/mnt/user/traderouter/scripts/phase1.sh script. Macro/model inputs remain display
only and do not alter bot decisions.

## Long Term 4hr demo

`/demo/4hrbot/` adds the third paper view and uses only the isolated
`/api/demos/long/status` feed. The shared Demo dropdown offers 15m, 1h and 4h.
Empty histories remain empty; unavailable, stale or mismatched feeds clear
the dashboard. Shadow decisions filter by `long`, while policy comparison
continues to show shared research across paper bots.

Validate with `node long-demo.test.cjs`, `node short-demo.test.cjs`,
`node shared-header.test.cjs`, `node shadow-demo.test.cjs` and
`node experiments-demo.test.cjs` while serving the root on port 8765.
Browser fixtures do not establish production data availability. These are
local frontend source changes until separately published to GitHub Pages;
backend runtime setup and verification remain in the private workspace.

## Public website polish - 2 October 2026

The shared desktop surface is 1380px maximum (previously 1220px). Sailing imagery,
logo, palette and Radio RRR playback code are retained. Macro cards use six columns
at 1200px and wider, three at tablet widths, two below 701px, and one below 360px.
Unavailable TOTAL market cap is hidden and the four coins wrap on mobile.

Run `node frontend-polish.test.cjs` for a self-hosted browser check, plus the
existing homepage, market-summary, shared-header and public-presentation tests.
The new check covers ten widths from 320px to 1920px, About, report publication
gating, stale and unavailable data, zero P/L, navigation and radio defaults.
All values injected by tests are fixtures; they are never public source readings.
These are local source changes, with no GitHub Pages publishing or NAS deployment.

## 4hr decision-flow page

`/demo/4hrbot/` is the canonical 4HRBOT page, using the decision-flow
layout introduced in V2. It includes settings, two groups of three decision cards
with configured-rule explanations beside each stage, performance, open trades, exit
monitoring and recent decisions. The old `/demo/long/` and V2 URLs redirect to `/demo/4hrbot/`; menus
contain a single 4 Hour option. The 15m and 1h dashboards retain their layouts.

Frontend files:
- `demo/4hrbot/index.html`
- `demo/rrr-trading-4hr-v2.html` (compatibility redirect)
- `demo/decision-flow.js`
- `decision-flow.test.cjs`

Settings, performance and open trades use the existing
`https://api.rrr.trading/api/demos/long/status` fields and formatting conventions.
Decision diagnostics use the additive read-only
`https://api.rrr.trading/api/demos/long/decision-flow` endpoint. Both poll every
15 seconds without navigation; failed requests retain explicitly stale previous
observations while the final current decision becomes UNKNOWN. The other feed
continues to update. Bot identity, paper mode and response freshness are checked.

The private backend adapter reuses the long bot's GET-only `pair_candles` and
`show_config` API, its existing public snapshot service, and retained 4hr
`execution_gates` evaluations/receipts in the existing research SQLite database.
It does not execute strategy code, write to trading or research databases, add a
bot, change a strategy, configuration, policy, statistics, or order execution.
The public response allowlists diagnostic fields and excludes raw tags, private
policy identities, frozen inputs and controls. History is limited to 20 retained
entry-confirmation records. No new table or persistence mechanism is added.

Per-check booleans, every failed/no-signal candle evaluation, admission results,
and final order delivery are not retained in that journal. Missing values stay
UNKNOWN or unavailable; an allowed gate vote never becomes LONG or ORDER SENT.
The latest closed analyzed candle supplies indicator observations and its real
entry/exit flags; its close time is labeled separately from receipt timestamps.
A current NO SIGNAL applies to the displayed pair, not every configured asset.
Daily values are the strategy's merged closed higher-timeframe values; missing
per-check outcomes and intrabar exit protection remain UNKNOWN.

The public four-hour diagnostic endpoint is deployed and was verified on 5 October
2026. The NAS runtime checks separately verified the guarded paper strategy,
fresh read-only saved inputs and preserved account/history. This frontend update
describes those entry rules; it does not deploy or change the bot. The separate
guard's individual decisions are not yet exposed in the legacy diagnostic feed.

Validation: `node decision-flow.test.cjs` covers feed identity, sample removal,
missing/stale data, partial outages/recovery, real decision states, escaped API
text, bot timestamps, 15-second DOM polling and 320/390/768/1440 layouts.
`node public-presentation.test.cjs` verifies all three existing standard demos.
Private `tests/test_decision_flow.py` covers analyzed closed-candle selection,
missing/stale signals, receipt attribution, read-only bounded history and no
false order/exit claims. Fixtures are test-only and are not current bot readings.


## 1HRBOT page

`/demo/1hrbot/` uses the shared decision-flow layout with the hourly trend strategy and 4-hour downtrend confirmation for shorts. `/demo/` redirects there, preserving query strings and fragments. Settings, performance, open trades, completed-trade history and asset analysis continue to use the existing `/status` feed. Completed totals use full win/loss statistics because hourly `closed_trades` is a capped history count.

The public hourly decision-flow endpoint currently returns 404. Diagnostic cards, exit monitoring and recent decisions therefore show UNAVAILABLE or UNKNOWN; the page does not substitute the 4-hour bot diagnostics. No backend deployment or strategy change is included.

## 15MINBOT page

`/demo/15minbot/` uses the shared decision-flow layout with the existing 15-minute pullback strategy and closed 1-hour trend confirmation. `/demo/short/` redirects there, preserving query strings and fragments. Settings, performance, open trades, completed-trade history and asset analysis use only `/api/demos/short/status`. Completed totals retain the short feed's `closed_trades` value.

The public `/api/demos/short/decision-flow` endpoint is available as of 5 October 2026. The page summarizes a complete, fresh asset scan, distinguishes a technical candidate from entry approval, and explains the shared one-position-per-asset rule across timeframes. Incomplete, stale or failed scans cannot establish why the bot has no trades. The homepage upcoming-event feed remains observation only for the currently running bot. This frontend change does not deploy a bot or change its strategy.


## Four-hour stage explanations

The four-hour page places a persistent configured-rule explanation inside each of its six stage cards: scan, technical signal, closed daily confirmation, entry intelligence, price/risk and final outcome. Expandable rules give the exact long/short indicator thresholds, stable-history requirement, saved 07:00 Brisbane macro cycle, required-data freshness/coverage, adverse-bias limits, primary event safeguards, calendar windows and half-ATR price allowance. Exit monitoring explains the unchanged stop, trailing and elapsed-hour profit targets.

The four-hour guard blocks unavailable required inputs; its available saved primary calendars are connected with explicit partial coverage. The numerical macro report's macro_events score remains distinct from that calendar risk check. The existing public decision-flow feed still exposes legacy context/gate observations, not the separate guard journal. Stage 4 labels this limitation, and neither saved homepage values nor a legacy approval are promoted to a current guard pass or filled order. Shared rendering retains the earlier explanations for the other timeframes.

The decision-flow browser checks also verify that explanations survive live DOM refresh and outages, and that expanded rules fit desktop and mobile layouts. This update changes frontend explanations only.

The 15-minute dashboard keeps all scanned assets visible in technical and 1-hour observation stages, including candles without entry signals. Scan tiles show supplied RSI, MACD versus its signal and the observed higher-timeframe trend; these are observations rather than reconstructed strategy decisions. Stale candles are labeled and compact current readings are hidden. All three paper engines allow cross-bot asset overlap, while retaining their own admission and position limits.
