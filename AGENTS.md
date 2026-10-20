# RRR.Trading — Frontend Agent Instructions

## Scope
- Repository: `C:\GitHub\rrr.trading` (GitHub Pages frontend).
- Homepage: `index.html`, `script.js`, `style.css`; shared assets are in the repository root.
- Backend: `T:\` → `/mnt/user/traderouter` on Unraid.
- For authorised backend work, follow the relevant private `AGENTS.md`.
- Never copy backend source, secrets or private configuration into this repository.
- Frontend publication does not deploy backend changes.
- Preserve trading logic, risk controls, execution, accounts and paper state unless explicitly authorised.
- Reuse existing components, endpoints and dependencies.

## Token-efficient workflow
- Complete one narrowly scoped task at a time.
- Prefer the smallest safe change; use Light reasoning when appropriate.
- Inspect relevant files and direct dependencies only.
- Avoid repo-wide audits, repeated searches, lengthy plans and historical phase reviews.
- For simple tasks: inspect → edit → focused verification → report.
- Investigate risky cross-system changes before implementation.
- Preserve unrelated modifications; avoid speculative refactoring.
- Do not modify `AGENTS.md` unless requested.
- Stop after completing the requested task.

## Data integrity
- Treat verified backend/API evidence as authoritative.
- Never invent prices, scores, trade results, approvals, timestamps or source coverage.
- Distinguish `UNKNOWN`, `STALE`, `UNAVAILABLE`, `PARTIAL` and valid zero values.
- Preserve provenance, freshness, units, timeframes and paper/live distinctions.
- Frontend components must not independently calculate trading approvals or risk decisions.
- Render API content safely; preserve accessibility and responsive layouts.
- For calendar work, preserve verified event times and `Australia/Brisbane` conversion.
- Consult feature documentation only when relevant; current code takes precedence.

## V4.1 diagnostics
For V4.1 diagnostics, trading-performance analysis,
Admin telemetry, intelligence investigations and Luna/SOL
handoff issues, read:

`//NAS/traderouter/v4/.agents/skills/v4-diagnostics/SKILL.md`

- Prefer this UNC path over the mapped `T:` drive.
- Read the skill once per task.
- Do not repeatedly search for or reinstall the skill.
- If inaccessible, report the exact error and stop.
- The skill is optional for routine frontend styling and navigation.

## Windows / Unraid environment
- Development runs on Windows; NAS files are accessible through `T:\`.
- Codex may encounter sandbox restrictions on NAS-mounted files.
- Distinguish permission failures from application failures.
- Use writable temporary directories for Python tests.
- After one reasonable workaround, report persistent environment failures.
- Do not bypass permissions or security controls.
- Unraid host has no Python; use Python inside suitable containers.
- V4 uses Docker Compose; V3 containers may not.
- NAS commands run through the local Unraid terminal, not SSH.
- Never modify V3 during V4 development.

## Verification
- Run only focused checks relevant to changed files.
- Expand testing only when justified by regression risk.
- For layout changes, check desktop, mobile and relevant interactive states.
- Distinguish pre-existing test failures from new regressions.
- Review the task-specific diff.
- Never claim production verification without supporting evidence.

## Frontend publication
- Routine frontend/documentation changes are authorised for publication.
- Commit only task-related files and push to `origin/main`.
- Never force-push or include secrets/unrelated modifications.
- Verify the push and GitHub Pages deployment.
- Perform one focused live check where possible.
- Respect explicit requests not to publish.
- Frontend authorisation does not include NAS deployment or trading changes.

## Completion
Report briefly:

**Changed / Verified / Published or Blocked**

Include only important limitations or outstanding risks.