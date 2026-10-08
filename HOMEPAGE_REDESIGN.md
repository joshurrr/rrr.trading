# Homepage layout and usability redesign

Frontend presentation only. Trading strategies, ranking, selection, entry/exit checks, sizing, balances, history, backend contracts and NAS services are unchanged.

## Changes

- `index.html`: Top 10 → Live Trading Activity → Trading Bot Performance → three Market Intelligence panels → expandable methodology. Existing renderer IDs remain in place; candidate, macro, research, assessment and synchronization details remain accessible.
- `homepage-dashboard.css`: homepage-scoped layout, five desktop opportunity columns, three bot cards and three intelligence panels, mobile wrapping, visible focus, 44px navigation targets and reduced motion.
- `homepage-dashboard.js`: weekday session clock with IANA time zones/DST and compact summaries of already rendered research. Conventional FX sessions are labeled separately from crypto's 24/7 availability; exchange holiday activity is not inferred. Session background: [OANDA session guide](https://www.oanda.com/us-en/skills-and-insights/education/trading-asset-classes/forex/when-is-the-best-time-for-forex-trading/).
- `homepage-intelligence.js`: stable bot cards, calm loading states and sharing the existing validated native status responses with the activity summary.
- `candidate-progress.js`: homepage-only summary prioritizes verified positions, reservations, selected horizons and blocked decisions. Native positions outside the Top 10 remain visible. Historical execution status alone does not prove a current position. Unavailable/stale evidence is explicit.
- Native current-run performance uses the same existing `/api/demos/{bot}/reporting` contract as the bot pages. The previous homepage `/execution/performance` response explicitly marks its figures unavailable in production. Cards display supplied `profit_closed_abs`, `win_rate` and `closed_trades`; no new performance calculation or legacy fallback. Reporting must match fresh execution health's run ID and start boundary, contain the expected collections, and have a current observation timestamp. Open counts use fresh native observations and the current-run start boundary.

No new API polling loop or backend endpoint was introduced. Existing refresh intervals remain. The session clock has a local timer only. Existing bot page files, shared header/style, research renderer, universe ranking renderer and modal source are unchanged.

## Verification

Fourteen relevant suites passed: `homepage-dashboard`, `homepage-intelligence`, `candidate-progress`, `asset-intelligence-modal`, `trading-universe`, `short-technical-cards`, `research-themes`, `catalysts`, `macro-rollover`, `v2-paper`, `v2-diagnostics`, `bot-summary`, `exit-telemetry` and `homepage` (`.test.cjs`).

New dashboard fixtures cover section order, ten cards/bubbles, current positions outside selection, pending reservations, selected horizons, blocking, stale decisions/positions, historical execution rejection, current-run P/L colours and run mismatch, loading placeholders, stable refresh nodes, independent API failure/recovery, session weekdays/DST, native disclosures, modal clicks, GET-only requests and no page errors. Layouts checked at 320/375/768/1024/1440; existing suites additionally check 1280/1920 and all three bot pages. Desktop/mobile screenshots reviewed under ignored `.runtime/`.

Existing tests updated only for requested section order, collapsed containers, native reporting fixtures and the five-column desktop breakpoint: `homepage.test.cjs`, `homepage-intelligence.test.cjs`, `candidate-progress.test.cjs`, `trading-universe.test.cjs`, `research-themes.test.cjs`, `catalysts.test.cjs`. Added `homepage-dashboard.test.cjs`.

Twelve other suites retain the same first failures against untouched baseline `9b6db7c`: `bot-universe`, `entry-progress`, `shared-header`, `public-presentation`, `decision-flow`, `completed-trades`, `exit-monitoring`, `15minbot`, `1hrbot`, `intelligence-wording`, `operating-modes`, `frontend-polish`. Their removed-section/navigation/heading assumptions were not rewritten to claim a blanket pass. The old homepage order assertion was intentionally updated for this redesign and its full suite now passes.

Actual public API preview passed all five requested widths, ten real assets, modal opens/closes and no JavaScript page errors. Localhost API access is rejected by the existing CORS policy; the actual-data preview used local frontend files at the permitted production browser origin. This preview is separate from GitHub Pages deployment and live verification.

## Evidence limits

Selection and opportunity scores do not establish trade approval or profitability. Reservations do not prove submitted orders or fills. Native activity can predate the current V2 run; performance remains current-run only. Missing feeds cannot establish no positions. Stale assessments remain in diagnostics and are excluded from current activity. Research/calendar limitations and stale source labels remain visible. Conventional global sessions do not claim exchange holiday availability.
