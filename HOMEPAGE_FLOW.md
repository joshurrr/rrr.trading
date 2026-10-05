# Homepage trading universe

The homepage presents the introduction, current Top 10, selection flow, research/themes and upcoming catalysts, saved macro environment, RRR Trading Assessment, current approved pair list with bot load status, and the three paper bots. Generic crypto price cards are omitted. Existing header, branding, bot routes and bot strategies are preserved.

The new trading-universe.js requests the public read-only /api/trading-universe endpoint. It shows ten ranked assets only after validating canonical schema, symbols/pairs, ranks, scores, timestamps and version. Each card shows its explanation, trend, macro fit, themes, catalyst score, evidence confidence, coverage and new-entry approval. Missing components stay unavailable. An expired saved selection remains visibly stale with new entries blocked; malformed or failed responses clear the cards. No sample readings are displayed.

Bot load status requires actual backend sync evidence: matching version, ten loaded pairs, a recent check and current entry eligibility. Unknown or older versions remain unavailable/stale. Legacy open positions are shown separately. Approved universe membership is a prerequisite for bot entry checks; each bot's technical and risk rules still decide whether to trade.

The backend reviews daily at 7 am Brisbane, retains last-known-good selections on failure, and applies a replacement margin to limit churn. Opportunity scores compare assets; they are not allocations or success probabilities. The public frontend never sends trading actions or private admin requests. Frontend publication and backend deployment are separate operations.

## Existing feeds

- /status, /api/demos/short/status, /api/demos/long/status: per-bot performance, shared with the existing bot overview.
- /api/reports/macro/today or the expected dated report before 7 am Brisbane: saved macro assessment, evidence confidence, coverage, component observations and FRED provenance.
- /api/research, /api/research/events/upcoming, /api/research/themes/latest: source-backed themes and catalysts with independent stale/unavailable states.
- /api/trading-context and per-bot decision-flow endpoints: market context and recorded candidate checks. These remain distinct from selection scores and entry execution decisions.

## Verification

trading-universe.test.cjs covers ten-card rendering, missing inputs, version-aware bot status, legacy positions, expired/stale/malformed/unavailable selections and responsive widths. homepage.test.cjs covers the revised hierarchy plus existing macro, radio and failure behavior. Screenshots are ignored preview artifacts under .runtime; fixtures never enter production feeds.

Layouts are checked at 320, 375, 768, 1024, 1440 and 1920 pixels, with five cards per row at desktop width. Both dedicated tests pass without page errors. The older homepage-intelligence.test.cjs passes its data assertions but its final navigation assertion targets the previously removed #demo-toggle control; the existing header was not modified for this task.
