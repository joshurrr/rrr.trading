# RRR.Trading — Frontend Agent Instructions

## Scope and boundaries
- Repository: `C:\GitHub\rrr.trading` (public GitHub Pages frontend). Homepage: `index.html`, `script.js`, `style.css`; shared styles/scripts are in the repository root.
- Private NAS backend: `T:\`. Read `T:\AGENTS.md` only for an authorised backend task; keep backend source, secrets, configuration and deployment artifacts out of this repository.
- Frontend publication does **not** deploy backend changes. Do not modify trading decisions, strategies, execution, risk controls, accounts or paper-run state unless explicitly authorised in the appropriate backend task.
- Use existing components, API endpoints, styles, and patterns. Do not add services, dependencies or frameworks without a demonstrated need.

## Efficient Codex workflow
- Prefer the smallest safe change that completes **one** clearly defined task. Target work suitable for Sol 6.1 Light when practical.
- Inspect only relevant files and their direct dependencies. Avoid repo-wide audits, long plans, repeated searches and rereading historical phase reports.
- For simple changes: inspect, edit and run focused checks in one pass. Do not manufacture extra phases.
- If a task spans unrelated areas, suggest small independent tasks and complete only the requested one. Do not silently expand scope.
- For risky or unclear cross-system changes: perform a narrow read-only investigation and report before implementing. Recommend Medium reasoning where Light would be unsafe or inefficient.
- Preserve unrelated local modifications. Avoid refactors, new abstractions, documentation rewrites and speculative enhancements.
- Do not amend `AGENTS.md` or write lengthy reports unless specifically requested.

## Data integrity and presentation
- Treat saved backend/API evidence as authoritative. Do not invent scores, prices, returns, timestamps, trade states, approvals or source coverage.
- Keep `UNKNOWN`, `STALE`, `UNAVAILABLE`, `PARTIAL`, loading and valid zero values distinct. Investigate misleading labels rather than hiding genuine missing evidence.
- Preserve freshness, provenance, units, timeframe, run identity and distinctions between paper, shadow and live trading.
- Frontend components are presentation-only unless expressly scoped otherwise; do not calculate trading approvals, risk policies or financial performance from incomplete feeds.
- Reuse existing safe DOM rendering and accessibility patterns (keyboard/focus, mobile layouts, reduced motion); avoid unsafe HTML from API text.
- For Schedule/calendar work, preserve verified source times and `Australia/Brisbane` conversion; never infer a time for date-only events. Refer to `SCHEDULE.md` only when relevant.
- Consult feature-specific docs (for example `VISITOR_ASSETS.md`, `TOOLS.md`) only for work on that feature. Current code and verified responses take precedence over dated phase notes.

## Focused validation
- Run the smallest relevant syntax check/test(s) for changed code; expand only for a demonstrated regression risk.
- For visible layout changes, check one desktop and one mobile viewport plus the affected interactive/empty/stale state where applicable. Avoid blanket screenshot or regression suites by default.
- Compare unrelated existing test failures with the baseline before attributing them to this change; do not rewrite unrelated tests to manufacture a pass.
- Review the task-only diff. State what was actually tested; never claim integration or production verification from a local preview or a healthy API alone.

## Publish requested frontend changes
- Standing authorisation: after focused validation, commit **only task-related files** with a clear conventional message and push to `origin/main`; no separate approval required for routine frontend/documentation changes.
- Never force-push, rewrite shared history, bypass protections or include credentials, NAS files or unrelated modifications. Respect an explicit request to keep changes local.
- Verify the pushed commit and successful GitHub Pages deployment, then make a focused live check of the affected behavior. Report blockers honestly; do not claim publishing succeeded from a push alone.
- This authorisation does not permit NAS deployment, trading changes or resets.

## NAS command guidance (only if relevant)
- NAS host has no host Python/pip or Docker Compose; Python is available in `traderouter-public` via `docker exec`.
- NAS commands are for the Unraid terminal, not SSH. For backend instructions, use the private `T:\AGENTS.md`.

## Completion report
- Keep it brief: **Changed / Verified / Published or Blocked**. Mention only material risks or remaining work.
