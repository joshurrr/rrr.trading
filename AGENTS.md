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

## Local repository access
- The existing local GitHub repository is the primary development workspace; edit project source files directly here.
- Codex should have read/write access to project source files within the authorised repository, subject to actual filesystem permissions and sandbox restrictions.
- Do not create temporary clones, duplicate repositories or alternative working directories.
- Do not modify files outside the authorised repository. Backend work requires a separately authorised workspace and its private instructions.
- If permissions prevent editing, report the actual restriction; do not repeatedly retry or bypass security controls.
- These workflow preferences do not override filesystem permissions, sandbox restrictions or security controls.

## Token-efficient workflow
- Complete one narrowly scoped task at a time.
- Prefer the smallest safe change; use Light reasoning when appropriate.
- Inspect relevant files and direct dependencies only.
- Avoid repo-wide audits, repeated searches, lengthy plans and historical phase reviews.
- For simple tasks: inspect → edit → focused verification → report.
- Investigate risky cross-system changes before implementation.
- Preserve unrelated modifications; avoid speculative refactoring.
- Avoid repeated builds and redundant test runs; do not retry identical commands after a confirmed environment or permissions failure.
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
- NAS access does not authorise writes outside this repository. Report access restrictions without changing NAS permissions.
- Distinguish permission failures from application failures.
- Keep any test files within the authorised repository; report persistent environment failures after one reasonable permitted workaround.
- Do not bypass permissions or security controls.
- Unraid host has no Python; use Python inside suitable containers.
- V4 uses Docker Compose; V3 containers may not.
- NAS commands run through the local Unraid terminal, not SSH.
- Never modify V3 during V4 development.

## Verification
- Use existing project dependencies and testing tools; check required dependencies are installed before running tests.
- Do not install new dependencies without explicit authorisation.
- Do not repeatedly attempt tests that fail because dependencies are missing.
- Playwright is optional unless explicitly required by the task. If unavailable, use lightweight validation appropriate to the changes.
- For simple frontend updates, prefer syntax checks, source inspection and targeted validation.
- Run only focused checks relevant to changed files.
- Expand testing only when justified by regression risk.
- For layout changes, check desktop, mobile and relevant interactive states.
- Distinguish pre-existing test failures from new regressions.
- Review the task-specific diff.
- Never claim production verification without supporting evidence.
- Report checks that could not run and their limitations; missing optional dependencies are not implementation failures.

## GitHub Desktop workflow
- GitHub Desktop is the preferred application for committing and publishing changes.
- Make requested source changes directly in the existing local repository and leave modified files available for review in GitHub Desktop.
- Do not automatically run `git add`, `git commit`, `git push` or other Git operations that modify repository metadata.
- Do not request elevated permissions to access `.git` merely to publish changes, or repeatedly retry Git commands after a permissions failure.
- Read-only Git commands may be used to inspect changes when permitted.
- GitHub Desktop will handle committing, pushing and publishing changes; do not attempt automatic Git publishing.
- Keep secrets and unrelated modifications out of published changes.
- Frontend work does not authorise NAS deployment or trading changes.

## Completion
1. Review the changed files and task-specific diff.
2. Run only relevant available checks.
3. Briefly report the files modified and resulting behaviour.
4. Identify validation limitations and any important outstanding risks.
5. Leave all changes in the local repository ready for review, committing and publishing through GitHub Desktop.

Do not attempt automatic Git publishing.
