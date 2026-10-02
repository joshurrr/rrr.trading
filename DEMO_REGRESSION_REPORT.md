# Public paper-demo regression restoration

Implemented locally for `/demo/short/` (15m), `/demo/` (1h), and `/demo/long/` (4h), plus the existing `website/demo/index.html` medium mirror. No publication, backend deployment, restart or account reset was performed.

## Historical evidence and root causes

Inspected current pages, shared JS/CSS, the prior asset module and Git revisions of the demo pages. Commit `33a2583` replaced the standalone implementations with `demo/public.js` and `demo/public.css` while intentionally removing engineering diagnostics.

The recoverable pre-refactor pages (`ec2d6c3` / `f747524`, and earlier demo history) contain **four**, not eight, summary cards: Starting balance, Realised P/L, Open positions and Win rate. The medium page's historically labelled Realised P/L actually read `profit_all_abs` and `profit_all_pct`; the futures pages read the closed-profit fields. There is no historical evidence of two missing cards or an original eight-card set. The refactor introduced the six current cards, then omitted historical percentage values, win-rate percentage, `.pos`/`.neg` CSS and class assignment on P/L values and table cells.

The final eight cards preserve all six current metrics and give the two existing historical percentage fields their own cards; they do not introduce accounting calculations:

| Card | Existing API field |
| --- | --- |
| Paper balance / equity | `portfolio.equity`, otherwise `portfolio.balance` |
| Total P/L | `portfolio.profit_all_abs` |
| Realised P/L | `portfolio.profit_closed_abs` |
| Starting paper balance | `portfolio.starting_balance` |
| Open positions | `portfolio.open_positions` |
| Win / loss | `winning_trades`, `losing_trades`; historical win-rate calculation included when there are completed trades |
| Total P/L % | `portfolio.profit_all_pct` |
| Realised P/L % | `portfolio.profit_closed_pct` |

Positive returns have an explicit plus sign and green colour; negative returns are red. Zero, missing values and failed/stale feeds are neutral. Colour comes from numeric fields, independent of LONG/SHORT direction. Only the P/L cells receive colour in trade tables; ordering, timestamps and existing public rationale mappings are preserved.

The medium page's historical `Asset Analysis` section and asset-module imports were removed by `33a2583`. The prior short/long pages imported the module but did not contain an asset-card container. The historical renderer used a static ten-asset research list, `/score` for trend score and confidence, and `/api/market-summary` for Kraken USD prices and daily movement. The original fields, names and responsive card styling are reused; unimplemented analysis fields still say Awaiting analysis. No shadow, challenger, veto or admin diagnostics are displayed.

All three pages now show the public asset cards below completed trades. Each page uses **its own validated status response's `bot.pairs`** for card membership and ordering, rather than a global research universe. Historical name definitions supply labels only. Missing bot lists and stale status clear the cards; missing research still leaves configured asset identities visible; stale/invalid market observations show unavailable prices with a clear note. Market prices remain explicitly USD and independent of the bot's trade prices and signals.

## Live public API check

Read all three existing status endpoints on 2 October 2026. All three currently supply the same ten pairs: BTC, ETH, SOL, XRP, LINK, ONDO, AAVE, UNI, HYPE and INJ, as USDT perpetual pairs. The renderer does not assume this equality; tests use different lists for each bot.

None supplies `portfolio.equity` or `portfolio.balance`. Historical frontend code displayed starting balance and did not calculate equity. Paper balance / equity therefore correctly remains **Unavailable**; no formula was invented. The medium feed also omits `profit_closed_abs` while supplying its closed percentage; these values are independently displayed without fabricating the amount. Both percentage fields are provided by all three feeds.

## Files and verification

Changed `demo/public.js`, `demo/public.css`, `demo/assets.js`, all three demo HTML pages, `website/demo/index.html`, `public-presentation.test.cjs`, `frontend-polish.test.cjs`, `FRONTEND_PRESENTATION.md`, and this report. Existing `demo/assets.css` is reused unchanged.

Passed:

- `node public-presentation.test.cjs`: all three routes; exact eight metrics; signed returns; computed green/red CSS; zero/unavailable neutral states; independent direction; supplied equity mapping; distinct ordered bot asset lists; missing/empty/unknown assets; research outages; stale market/status data; recovery; no page errors or public diagnostics; selector navigation and active highlighting; summary/asset column counts and no document overflow at 320, 375, 768 and 1440 pixels. Desktop/mobile screenshots inspected.
- `node frontend-polish.test.cjs`: homepage/report presentation, missing/stale/failure recovery, six-page navigation and responsive overflow, keyboard navigation and Radio RRR opt-in/error controls.
- `node shared-header.test.cjs` against a local preview: active navigation, demo dropdown, six widths, keyboard/Escape/outside-click, Radio RRR controls. An initial run without its required local preview failed to connect; rerunning with the preview passed.
- `git diff --check`: passed.

Tests use local fixtures, never account mutations. The bundled Node packages were supplied through `NODE_PATH`; no dependency installation was needed.

The 15 MIN / 1 HOUR / 4 HOUR selector, routes, active highlight, bot naming and PAPER/RUNNING status remain intact. Trading engine/strategy logic, thresholds, configuration, scheduling, macro calculations, databases, paper balances and trade history were untouched. Admin functionality and Radio RRR playback logic were untouched. Changes are ready for the existing GitHub Desktop publishing workflow.
