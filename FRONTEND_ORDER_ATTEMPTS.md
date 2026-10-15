# Frontend entry orders and filled positions

This read-only frontend update separates zero-quantity pending entries from positive-quantity native positions. Partial fills remain positions with an explicit label. Missing/invalid fill quantities remain unverified; they never prove there are no positions.

The 15m/1h/4h dashboards show **Entry orders & attempts**, using the existing execution-record and current-run reporting GET feeds. Native pending-entry evidence is distinct from authorization records and lifecycle evidence. Older backends show an explicit lifecycle limitation. No order submission, backend deployment, strategy, bot settings, paper-state or execution changes are included.

The homepage instead shows **24-hour trade history**, collapsed by default using a native keyboard-accessible disclosure. Completed current-run paper trades use the already-fetched reporting feeds, with one full-width responsive row per trade, newest close first. Rows show asset, bot, side, entry/exit prices, realized P/L and Brisbane close time. Pending orders and authorization records are not completed trades. Opening the section adds no API requests; refresh preserves the disclosure state. The window ends at the oldest verified report observation, matching the performance window. Missing/stale/mismatched or malformed history remains unavailable; incomplete feed coverage is explicit. Every supplied qualifying trade is shown without an additional display limit; the frontend cannot recover records omitted by the existing API.

Homepage files are `homepage-trade-history.js/.css/.test.cjs` and the homepage script/style references. The focused suite covers collapsed/keyboard/refresh behavior, the exact 24-hour boundary, all three bot reports, full-width rows at 320/375/768/1440, more than 50 records, partial/stale/unavailable/empty/malformed/duplicate/future/run-mismatch states and safe text. Local screenshots remain ignored under `.runtime/trade-history`.

The order panel tracks the actual successful execution-record receipt time, plus fresh matching PAPER run metadata. Unrelated UI/reporting refreshes cannot renew its age. Failed requests, mismatched runs, malformed record collections and invalid future receipt times suspend current claims. Stale retained records are labelled saved only. Requested margin, executed margin and filled quantity are distinct; unavailable values are not invented.

Pending or unverified entries suspend affected portfolio totals instead of presenting their contribution as known P/L. Realized closed-trade evidence remains independent. The bot layout retains the order panel outside collapsed operational diagnostics. All displayed API text uses text nodes.

Verification: `order-attempts.test.cjs` covers pending/partial/filled/timed-out/rejected/older-backend evidence, safe text, disclosure retention, GET-only access, 320/375/768/1440 widths on all three bots, source receipt expiry/future dates, run mismatch, malformed/missing records and the persistent radio shell. Screenshots stay ignored under `.runtime/order-attempts`.

Activity accounting fixtures now include explicit filled quantities and test zero/missing quantities. Their deterministic accounting checks pass. The historical activity browser fixture still expects legacy status-only financial reporting; it fails identically with committed source (`Unavailable` versus `+297.00 USDT`). The older radio-navigation fixture lacks the V3 generation evidence required to reveal its main content; the new focused suite verifies the actual shell with valid generation evidence. No blanket legacy-suite pass is claimed.

Publishing and live verification are separate from fixture evidence. Frontend publishing does not deploy or upgrade backend order lifecycle collection.
