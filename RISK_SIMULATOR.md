# Risk simulator — Phase 1

Homepage-only native dialog, opened by the amber CUSTOMISE RISK button above trading performance. Defaults: 1.5× leverage, 500 USDT margin per position, four positions and 100 USDT hypothetical daily new-entry cutoff. Leverage is bounded to 1–2×; presets affect leverage only. Other values show Custom.

Position exposure = margin × leverage; portfolio exposure = position exposure × position count. Six long-position scenarios use exposure × signed price movement; margin return = leverage × movement. Fees, funding, slippage, liquidation and maintenance margin are excluded. The cutoff does not cap scenario losses or enforce protection.

Browser-only `rrr.trading.visitor.risk.v1` stores a versioned settings object after explicit Save or Reset. Values, types, ranges and increments are validated on restore. Invalid records restore defaults; disabled storage leaves the calculator usable for the visit. No network calls, global trading configuration or bot changes. Future authenticated configuration requires a separate account-specific backend-validated contract.

Run `node risk-simulator.test.cjs` with Playwright available. It covers arithmetic, upper bounds, presets, Custom, refresh persistence, persisted reset, invalid/disabled storage, keyboard/focus, backdrop, scroll restoration and 320/375/768/1440 layouts. Screenshots remain ignored under `.runtime/`.

Local verification on 11 October 2026: simulator, visitor-assets and trading-universe suites passed. Desktop/mobile screenshots reviewed. The short-technical-cards suite timed out waiting for `window.renderAssetBranches` on the 15m bot; the identical timeout occurred on an archived untouched HEAD. No bot files were changed. This does not constitute a blanket legacy-suite pass. Publication is verified separately through the matching Pages workflow and live checks.
