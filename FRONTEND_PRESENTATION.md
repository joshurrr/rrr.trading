# Public demo presentation update

The 15m, 1h and 4h demos share `demo/public.js` and `demo/public.css`, with a highlighted timeframe selector. `website/demo/index.html` uses the same medium demo markup.

Public pages retain paper status, existing portfolio values, open trades, recent completed trades, win/loss counts and observation timestamps. Eight summary cards include the existing total and realised percentage fields, with numeric green/red P/L styling. Equity and realised P/L remain unavailable when the feed does not provide them. Known exit reasons receive simple labels; internal entry tags and unknown exit identifiers are not printed.

Raw status JSON, strategy/runtime configuration, detailed context, shadow decisions and policy comparisons are no longer rendered or requested by these pages. The historical public Asset Analysis renderer is restored below completed trades, using each validated status feed's `bot.pairs` for membership and ordering, `/score` for public research fields, and `/api/market-summary` for fresh USD prices. These scores are separate from bot decisions; missing readings remain unavailable or awaiting analysis. No Admin link was added. Diagnostic modules are not loaded by the demos. Existing public API endpoints were not changed.

The private admin presentation and its deployment notes are maintained separately from this repository. This frontend change does not alter trading calculations, strategies, configuration, balances or history.

## Validation

Run `node public-presentation.test.cjs` with Playwright and Edge available. This test serves its own local preview and mocks status APIs; fixtures are test data only. The existing demo/context/shadow/experiment test entry points delegate to the new presentation checks because those diagnostic panels have been removed from the public UI.

Checked all three demo routes, eight-card metrics, computed positive/negative colours, zero and missing values, distinct bot asset lists, empty/missing/unknown assets, stale market data, research failures, timeframe navigation, stale status data, API failures and recovery, absence of public diagnostics, page errors and overflow at 320/375/768/1440 pixels. Frontend polish and shared-header regression tests also pass. Desktop and mobile screenshots were reviewed. See `DEMO_REGRESSION_REPORT.md` for historical evidence and the live API field check.

These are local source changes. GitHub Pages has not been published by this task.
