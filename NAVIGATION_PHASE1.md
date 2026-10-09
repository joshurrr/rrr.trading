# Frontend redesign Phase 1 — 9 October 2026

The shared navigation now has exactly four primary links: LIVE ANALYSIS `/`,
SCHEDULE `/schedule/`, TRADING BOTS `/bots/`, TOOLS `/tools/`. A separate disclosure
beside Trading Bots opens All Trading Bots and the three existing dashboard
shortcuts. It supports mouse/touch, keyboard Tab, ArrowDown opening, Escape with
focus return, outside click and focus-leave dismissal. Bot pages highlight the
Trading Bots primary link. The logo, session calculations/clock, Top-10 validation
and polling, symbol dialogs and RadioRRR player are preserved.

`/bots/` contains three responsive read-only summary cards. One frontend registry
supplies card identities, existing GET routes, dashboard links and submenu entries.
Future existing bots can be added in `bot-registry.js`; this never creates or
enables a bot. The grid also accommodates larger collections without primary-menu
changes. The schedule page is only a placeholder, without events, calendar
calculations or new integrations. Homepage content and Tools monitoring are intact.

## Evidence ownership

- Native status uses `/api/demos/short/status`, `/status`, `/api/demos/long/status`:
  matching timeframe/identity, `ok=true`, PAPER/LIVE mode and observation age
  from -30 through less than 30 seconds. RUNNING/STOPPED require supplied state;
  unknown state does not become Running because HTTP succeeded. Native version
  and configured position limit come directly from this evidence.
- `/api/demos/{short,medium,long}/reporting` owns current-run metadata and
  `portfolio.open_positions`, `closed_trades`, `win_rate`, `profit_closed_abs`,
  `profit_open_abs`, `profit_all_abs`. These fields are formatted, never recomputed.
  The existing 45-second current-run report predicate was moved unchanged from
  `demo/v2-paper.js` into the registry and is shared by both presentations. The
  overview additionally requires a nonempty string run identity and a valid
  nonfuture run start. Live native mode never displays paper-run performance.
- Native status and reporting failures are independent. Missing, malformed,
  stale, partial, zero and loading observations remain distinct. Expiry is checked
  between polls. Actual response timestamps appear separately in Brisbane time;
  saved expired timestamps are explicitly labeled. Native legacy portfolio values
  never substitute for unavailable current-run performance.
- Process state, actual current-run open count, configured limit and entry
  eligibility are separate rows. Eligibility remains Unknown: these feeds do
  not establish full entry approval. The configured limit does not claim free
  capacity. No additional eligibility or financial calculations are introduced.
- One request per native/reporting route per 15-second overview cycle, 15-second
  request timeouts and an in-flight guard. Hidden pages skip refresh; visibility
  return refreshes. Header Top-10 uses its existing single feed. No detailed bot
  polling modules are loaded on the overview. API strings use text nodes.

## Files

Created: `bot-registry.js`, `bots/index.html`, `bots/bots.js`, `bots/bots.css`,
`schedule/index.html`, `navigation-phase1.test.cjs`, this report.

Modified: `site-header.js`, `site-header.css`, `demo/v2-paper.js` (shared report
predicate only), `index.html`, `about.html`, the three `demo/*bot/index.html`
dashboards, `tools/index.html`, three archived report HTML files and the existing
`website/demo/index.html` reference (registry script/header cache versions).
Navigation-only expectations were updated in `tools.test.cjs`,
`shared-header.test.cjs`, `operating-modes.test.cjs`, `1hrbot.test.cjs`.
Documentation: `README.md`, `TOOLS.md`, `AGENTS.md`.

## Local verification

Passed: `navigation-phase1.test.cjs`, `tools.test.cjs`,
`homepage-intelligence.test.cjs`, `homepage-dashboard.test.cjs`,
`bot-summary.test.cjs`, `v2-paper.test.cjs`, `v2-diagnostics.test.cjs`, `exit-telemetry.test.cjs`,
`asset-intelligence-modal.test.cjs`, `trading-universe.test.cjs`,
`short-technical-cards.test.cjs`. Syntax and diff whitespace checks pass.

The new Phase 1 suite covers all public shared-header routes and existing bots,
four primary destinations, active groups, shortcuts, touch/keyboard/focus,
sessions, ten bubbles/dialogs, radio default/error handling, safe text, independent
feed failures, expiry, loading/zero/partial/stale/wrong-timeframe/stopped/live/new-run
states, no legacy fallback, GET-only requests and one request per owning feed.
It tests 320/375/768/1024/1440/1920 widths and a 12-card layout. Desktop/mobile
overview and schedule screenshots were inspected locally under ignored `.runtime/`.
Existing bot suites retain their established responsive/accessibility coverage.

Historical limitations are retained, without removing unrelated assertions:

- `candidate-progress.test.cjs` still expects the old session heading; the same
  failure was reproduced on untouched HEAD `3ff9a8b`.
- `1hrbot.test.cjs` still expects its old bot-specific header heading; same on HEAD.
- Original `shared-header.test.cjs` and `operating-modes.test.cjs` already failed
  on outdated navigation expectations. After navigation-only corrections in an
  ignored baseline copy, the same remaining obsolete bot-title assertion and
  missing `#navigation` assertion were reproduced on HEAD. Production tests keep
  those unrelated assertions. They are not claimed as passing.
- Historical 320px hourly-dashboard overflow remains outside this navigation
  task. New header and overview widths pass; the existing comprehensive dialog
  and bot-summary layout tests remain passing. No blanket legacy-suite claim.

The initial sandbox prevented Edge startup and local-server access; checks were
rerun with the existing bundled Playwright and Edge in the permitted execution
environment. No dependency installation was required.

## Publication and scope

Publication verification is recorded after the task-only commit reaches GitHub,
the matching Pages workflow succeeds and actual live pages are checked.
Local fixture tests or an API response alone do not establish publication.

All work stays in the frontend repository. No NAS workspace access, backend
Python, trading logic/data, API contracts, services, Docker/configuration,
statistics/reset, positions, strategy, risk, execution or learning was changed.
No backend restart/build/deployment or administrative/trading write was performed.
Stop after navigation redesign Phase 1; schedule Phase 2 and homepage Phase 3
remain deferred.
