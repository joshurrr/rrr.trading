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

The daily report fragment is a labelled template until a real briefing is
published. Existing archive entries remain labelled examples. Score sentiment
provenance is displayed, including placeholder/manual inputs. Homepage build 20260930.6 removes the old snapshot, sentiment details and
explanatory sections. Trend environment awaits a market-wide API field.

Validation: serve the root with `python -m http.server 8765`, then run
`node homepage.test.cjs` with Playwright installed and Microsoft Edge available.
The browser test intercepts API requests with test-only fixtures and checks
responsive widths, missing values, partial and complete API outages, navigation,
report loading, archive, radio defaults and `/demo` routing.
Screenshots are written to the OS temporary directory.

Deployment follow-up: `/status`, `/score` and `/market-regime` returned HTTP 404
when checked on 30 September 2026. Restore those public routes and verify CORS
allows `https://rrr.trading` before expecting current data to appear.

## Shared public header

`site-header.js` owns the logo, navigation, mobile menu and opt-in Radio RRR
player; `site-header.css` scopes its appearance across the public pages.
Reports and the labelled example archive live at `/reports.html`. The Demo menu
links to `/demo/short/` (15 Min), `/demo/` (1 Hour), and `/demo/long/` (4 Hour).
The existing About link remains `/#about`; no About content exists in the
current source. Archived reports select Reports.

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
0–100 score and regime. Reports must match today's Brisbane date; stale or
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

`/demo/long/` adds the third paper view and uses only the isolated
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
