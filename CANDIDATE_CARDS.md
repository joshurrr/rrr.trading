# Homepage candidate portraits — 11 October 2026

Frontend presentation only, inspired by the image-led Live DJ cards on Radio RRR.
`candidate-cards.js/.css` supplies the shared homepage Recommended/My Assets
presentation. No backend, API contract, scoring, selection or trading changes.

Cards retain the existing five-column desktop, three-column tablet and two-column
mobile grid (one column below 360px). The clickable artwork is 260px tall on
desktop and 250px on mobile. A separate native 44px Selection evidence disclosure
keeps full reasons, confidence, timeframe eligibility and entry/position diagnostics
available without filling the collapsed artwork with technical text.

Existing CoinCap logo URLs are reused for large artwork and small ticker icons.
Failed logos show a deterministic neon monogram. BTC/ETH/SOL/XRP have colour
presets; all other identities receive stable hashed palettes and candle patterns.
Those candles are decorative artwork, never plotted price observations or signals.
Long tickers wrap; long fallback monograms abbreviate while the ticker stays intact.
No runtime image generation, libraries, paid services or new card API requests.

Scores retain the existing 0–100 display/formatting and backend trend categories.
Colour follows the supplied trend rather than introducing new score thresholds.
Reasons show one concise excerpt; full text stays in Selection evidence. LONG/SHORT
requires an explicit supplied direction or the existing independently verified
position/decision presentation in `candidate-progress.js`. Missing directions are
omitted. Stale selection, blocked entry, missing personal approval and unavailable
scores remain honest; personal membership never grants entry approval.

Keyed reconciliation retains card/button/image DOM when scores refresh and rankings
move, including keyboard focus where supported by native DOM moveBefore. Failed or
invalid central selection still clears the cards using the original validation.
The existing shared native asset dialog, requests, error handling and transitions
remain unchanged. Hover/press effects use CSS transforms; reduced motion disables
them. All API strings use text nodes.

Verification: `candidate-cards.test.cjs`, `trading-universe.test.cjs`,
`visitor-assets.test.cjs`, `asset-intelligence-modal.test.cjs`,
`short-technical-cards.test.cjs`, `activity-refresh.test.cjs`,
`activity-performance.test.cjs`, and `navigation-phase1.test.cjs` pass.
Checks include four widths (320/375/768/1440), unknown/failed logos, long symbols,
safe evidence text, actual scores/directions, retained refresh/reorder focus,
GET-only isolation, reduced motion, dialog lifecycle and personal storage/approval.
Screenshots and real-public-feed browser previews remain ignored in `.runtime/`.
Historical unrelated fixture limitations in AGENTS.md remain; no blanket suite or
backend verification is claimed. Publication is verified separately through the
matching GitHub Pages workflow and live frontend behavior.
