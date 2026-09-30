# TradeRRR frontend project instructions

## Workspace boundaries

- `C:\GitHub\rrr.trading` contains only the public frontend. GitHub Pages publishes this repository.
- Homepage files are `index.html`, `script.js`, and `style.css`.
- `T:\` is the secure NAS backend workspace. Read `T:\AGENTS.md` before backend work.
- Never put backend code, API keys, secrets, NAS configuration, or backend archives in this frontend repository.
- Publishing frontend changes to GitHub does not deploy the backend.
- When working across both source folders, keep each change in its appropriate workspace.

## Macro presentation

- Fetch saved daily macro reports through the existing public API; do not embed sample values as current readings.
- FRED is the primary macro source. Do not scrape TradingView.
- Never fabricate values or silently substitute stale observations.
- Retain actual observation dates and display unavailable or stale states clearly.
- The macro score is a base input for later overall trading assessments. Do not invent its percentage weight or treat the score as a trading allocation or success probability.
- Keep source confidence, data coverage, macro score, and future trading weight distinct.
- `macro_events` remains unavailable until a reliable structured calendar source is connected.

## Verification and communication

- Inspect existing files and applicable instructions before making changes. Do not overwrite unrelated changes.
- Test frontend layouts on desktop and mobile, including unavailable and stale-data handling.
- Distinguish local source changes, published frontend changes, backend deployment, preview output, and saved scheduled reports.
- Do not claim deployment or data integration succeeded based only on a healthy API.
- Keep secrets out of source, Git, command history, logs, screenshots, and chat. Verify configuration without printing secret values.

## NAS command boundary

- The NAS host has neither Python nor Docker Compose installed.
- Do not prescribe host `python`, `pip`, `docker compose`, or `docker-compose` commands for the NAS.
- Python is available inside the `traderouter-public` container. Use `docker exec` for NAS Python commands.
- Windows development tools are separate from the NAS host; a local Python installation does not imply Python exists on the NAS.
- For backend paths, rebuild commands, persistent storage, and secret setup, use the private instructions in `T:\AGENTS.md`.
