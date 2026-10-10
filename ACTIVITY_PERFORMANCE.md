# Homepage activity performance — 10 October 2026

## Native opening time and size

Open cards reuse the already fetched 15m/1h/4h PAPER status records, preserving
bot-scoped trade IDs and existing freshness checks. `open_date` is the native
engine entry timestamp (timezone-less native dates are UTC), displayed in
Australia/Brisbane with seconds. Time open is elapsed whole minutes from that
timestamp and updates locally every minute; reloads retain the engine date.
Missing, malformed or future entry dates display Unavailable.

Trade size is remaining native `amount × open_rate`, in USDT at entry price;
it is not current mark valuation or configured maximum stake. Native trade
`stake_amount` is displayed separately as margin, with `leverage`. Missing values
remain Unavailable. Original size before partial exits is not exposed by these
feeds and is explicitly Unavailable; no original quantity is inferred.

Unrealised P/L remains the unmodified native `profit_abs`/`profit_pct`, alongside
prominent time open. Responsive cards retain cyan borders, profit/loss colours,
the existing 24-hour summary and candidate decisions. No backend changes,
trading writes, sizing changes, additional polling or container restarts.

Focused tests cover Brisbane conversion, duration boundaries, leveraged and
reduced remaining sizes, missing/future fields, minute updates without requests,
all-bot cards, stable DOM/P/L, outages and 320/375/768/1440 layouts. Publication
and actual production verification are reported separately from local fixtures.

Frontend-only, read-only. No backend, database, strategy, execution, configuration,
risk, PAPER epoch or bot restart changes. No new polling or historical storage.

## Data and accounting

Reuses `window.homepageBotStatus` from the existing homepage loader:

- 15m: GET `/api/demos/short/status`
- 1h: GET `/status`
- 4h: GET `/api/demos/long/status`

Only fresh, correctly identified PAPER/USDT feeds enter the aggregate. LIVE data
is excluded. Position observation time is checked separately when supplied.
Trade IDs are scoped by bot. Identical duplicates are counted once; conflicting
duplicates, malformed identities/dates and open/closed collisions invalidate the
affected evidence. Candidates have no P/L. Current native `profit_abs` and
`profit_pct` are displayed for verified open positions without reconstructing
profits from price, notional or leverage. Missing values remain unavailable.

The rolling window ends at the latest common supported observation (the oldest
of the fresh bot `generated_at` values), exactly 86,400,000 milliseconds after
its start. This avoids assuming an older feed observed trades closed between
its response and a newer bot response. With missing feeds, recorded subtotals
use the common endpoint of only the available feeds and remain partial. Closed-trade statistics include
only close timestamps in `(start, end]`; naive native trade timestamps are UTC.
The independent bot observations are not represented as simultaneous valuations.
Trades opened before the window are included if they close within it. Realised
P/L here is their native lifetime closed result, not their equity contribution
since the start of the window. Win rate is positive-result closes / all closes;
break-even closes remain in the denominator. No closes means no win rate.

Existing adapters request native closed history ordered by closing date descending
and expose at most 25 records per bot. Full window coverage requires either all
saved closes (matching the exposed closed count) or a correctly ordered 25-record
page reaching the start boundary. Otherwise show a clearly labelled recorded
subtotal/count, with no complete win rate. Missing P/L invalidates the subtotal.
Do not replace these with lifetime portfolio totals or current-run reporting.
The native database history is independent of homepage refresh, process startup,
asset promotion and V2 run filtering; the frontend neither resets nor edits it.
Any externally deleted/reset database history cannot be reconstructed here.

Native P/L is reused without subtracting estimated fees or funding again.
[Freqtrade accounting](https://www.freqtrade.io/en/2023.6/bot-basics/) includes
fees; the public adapters do not expose independent itemised fee/funding records
or verify completeness of those components. No independently reconciled funding
total is claimed. Native paper accounting is simulated trading data, not live
exchange account returns.

## Missing equity history

24-hour net P/L and unrealised P/L change remain explicitly **Unavailable**.
The public feeds provide neither historical all-position valuations nor an
external cash-flow ledger. Never add current unrealised P/L to realised closes
to invent the result. Starting equity and positions already open at the boundary
must be accounted for, including positions closed later in the window.

Private source investigation found existing `paper_equity_observations`, but
these are scoped to V2 execution records/current run and explicitly exclude
legacy P/L. They cannot establish combined all-native-position equity or exact
24-hour boundaries. Existing current-run reporting likewise excludes trades
opened before its run boundary. Neither is substituted for combined performance.
No new snapshots were added: they could not recover the missing prior valuations
or cash-flow reconciliation, and the requested honest realised-only fallback is
available without database growth or a backend deployment.

Public inspection on 10 October confirmed PAPER/USDT on all three bots; exposed
history lengths were 25/25/16 and reached 6 October. Counts are observations,
not constants. Current positions included pre-window holdings. Coverage is
re-evaluated on every existing 30-second homepage refresh. Missing/stale feeds
suspend complete totals and open counts; the last successful all-bot observation
timestamp remains labelled as historical. Activity rows retain their DOM during
P/L updates and disappear when no longer confirmed open. No extra requests.

## Verification

`node activity-performance.test.cjs`: deterministic boundary/duplicate/malformed/
zero/partial/missing/stale/PAPER-LIVE checks; browser all-bot P/L, positive/negative/
neutral styles, update DOM preservation, close/outage handling, no render polling,
and 320/375/768/1440 widths. Screenshots reviewed under ignored `.runtime/`.
`node homepage-dashboard.test.cjs`, `node trading-universe.test.cjs` and
`node short-technical-cards.test.cjs`: passed existing relevant regressions.
Shared candidate regression fails at the hero-label assertion on both changed
source and an isolated untouched HEAD copy (`LIVE CRYPTO PERPETUALS` versus the
older session-label expectation). Its later checks are not reached; no blanket
shared-suite pass is claimed.

Files: `activity-performance.js`, its test, `candidate-progress.js`,
`homepage-dashboard.css`, `index.html`, and this document. Homepage cache versions
are updated; bot page scripts and layout are unchanged. Publishing is separate
from backend deployment. Net performance remains unavailable after publication.

## Refresh stability repair — 10 October 2026

Live observation reproduced the defect: the homepage status owner polled every
60 seconds after request completion, while activity expired observations at 30
seconds. Independent candidate/performance updates then removed valid recent
rows before the next status request. The initial live trace showed three feeds
at ages 10/20/30 seconds, zero at 40/50/60 seconds, and recovery on the next poll.

The existing status owner now starts refreshes every 30 seconds, with a shared
in-flight promise preventing overlapping visibility/manual/timer requests.
Homepage-only status/position presentation expires after 45 seconds (30-second
cadence, 10-second bounded request, 5-second API cache allowance). Status and
position observation timestamps both remain checked. Decision-flow, execution,
trading and protection freshness rules stay independent and unchanged.

A failed request may retain a previously successful observation only within that
bound, with explicit refresh-failure labels. Invalid/stale fulfilled responses
replace prior data immediately. Once evidence expires, counts/P/L are unavailable
and unverified position rows are removed; a successful empty position list removes
closed trades immediately. Hidden pages pause polling and refresh on return.

`node activity-refresh.test.cjs` exercises actual page timers through three
30-second cycles, one request per feed/cycle, retained DOM, failed-refresh
retention/expiry/recovery, closures, invalid PAPER/LIVE responses and overlapping
manual/visibility requests. Accounting and responsive/homepage regressions are
rerun. `homepage-intelligence.test.cjs` failure-label expectations now reflect
bounded retention, without changing its unrelated assertions.

Additional files for the repair: `script.js`, `homepage-intelligence.js`,
`homepage-intelligence.test.cjs` and `activity-refresh.test.cjs`. Homepage script
cache versions are bumped. No backend changes or bot restarts.
