# Shared hero refinement — 10 October 2026

The shared `site-header.js` and `site-header.css` now provide three desktop
columns for branding, live session/Top-10 information, and Radio RRR. The logo
preserves its aspect ratio with a 225px maximum width. The desktop hero has a
200px minimum height and grows when content wraps. Heading and dynamic session
appear separately; candidate buttons are 32px tall with 8px gaps. The existing
description has brighter 12px text beneath the candidates.

At 1100px typography and column spacing reduce. At 900px branding and radio
share the first row with centred information below; at 600px the top row and
typography become more compact. Radio labels remain visible on mobile. Its
existing media events control the stopped-only 2.5-second pulse; playing uses
a steady glow and reduced motion disables the pulse.

The artwork, logo asset, neon rails, four navigation routes/disclosure, UTC
weekend/IANA regional session calculations, trading-universe validation,
ranking, refresh intervals, dialog interactions, audio URL and playback
implementation are preserved. Only shared presentation and its HTML cache
versions change. No backend or trading changes are included.

Run `node hero-layout.test.cjs` with Playwright available. This self-hosted test
covers all 12 shared-header pages at 1920/1366/1024/768/390/375/320px, column
separation/vertical centring/desktop height, hero bounds, long ticker wrapping,
dynamic weekend/regional/DST sessions and visibility refresh, candidate dialogs,
radio play/pause event handling, stopped/playing/reduced-motion animation and
stale/unavailable selection. Set `RRR_HERO_BASE_URL=https://rrr.trading` to check
deployed pages with the actual public universe feed. Audio controls use simulated
media events for deterministic checks; this does not claim stream availability.

Local hero, navigation-phase1, asset-intelligence-modal, trading-universe and short-technical-card
suites passed. Syntax and whitespace checks passed. Desktop/mobile screenshots
are inspected locally under ignored `.runtime/hero/`. There is no package-level
build/lint script in this static frontend repository. Existing unrelated legacy
test limitations documented in AGENTS.md remain outside this task.

Publication requires the task commit on origin/main, its matching successful
GitHub Pages workflow and separate live frontend verification.
