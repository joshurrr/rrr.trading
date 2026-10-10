# Global homepage header — 11 October 2026

Every public content page uses the existing `data-site-header` mount and the same
`site-header.js` / `site-header.css` implementation. The current homepage artwork,
logo, title, inline session / TOP 10 CANDIDATES row, neon bubbles, Radio RRR player
and four-link navigation are now the default composition. The former alternate
markup, explanatory header note and homepage-only CSS selectors are removed.
No framework, build step or extra header implementation was introduced.

Covered pages: homepage, Schedule, Bots overview, all three bot dashboards, Tools,
About, the three archived September reports and `/website/demo/`. Existing demo
aliases redirect to their owning dashboards. `data/daily-crypto-report.html` is an
embedded report fragment, and `server/templates/admin.html` is a separate admin
template, not a public website page; neither receives a second header.

Header session calculations and radio events are unchanged. Homepage and bot
universe renderers still supply their existing saved responses to
`SiteHeader.renderAssets`; other pages retain the existing single header feed.
No additional API requests, polling loops, calculations or trading writes were
introduced. Every bubble uses the existing shared asset-intelligence dialog.
About and archived reports correctly highlight none of the four primary sections;
bot dashboards and the legacy public demo highlight Trading Bots.

The shared stylesheet explicitly owns the radio subtitle weight previously
inherited from the homepage stylesheet. All public pages reference matching
`20261011.global` cache versions. Future header changes belong in the two shared
files, rather than page markup or page styles.

Verification: `navigation-phase1.test.cjs` checks all 12 pages, one header and
selection request per page, identical homepage header geometry and computed
styles at 320/375/768/1024/1440/1920, navigation links/current states, mouse/touch/
keyboard dropdowns, dialogs, stale/unavailable selection, radio state/error
handling, GET-only requests and no JavaScript page errors. Motion is disabled
for deterministic appearance comparisons. Desktop/mobile screenshots were
reviewed under ignored `.runtime/`. Asset-intelligence-modal, trading-universe,
short-technical-cards and Schedule regression suites pass. Existing unrelated
legacy fixture limitations remain as documented in AGENTS.md; no blanket suite
claim is made. Radio playback requires a user gesture; automated tests verify
controls/events and retry behavior, not audible output.

Frontend publication and live verification are reported separately. No backend,
bot configuration, strategies, database, execution or Schedule logic changed.
