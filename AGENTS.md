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

## Standing authorization to publish

- For requested frontend and frontend-project documentation changes in this repository, complete the work and relevant checks, review the diff, commit only task-related files, and push to `origin/main` without asking for separate confirmation to commit, push, or publish.
- Use small, focused commits with clear conventional commit messages. Preserve unrelated local changes and never include secrets, backend files, or NAS configuration.
- Verify that the pushed commit reaches GitHub, that its GitHub Pages deployment succeeds, and that relevant live frontend behavior matches the change. Do not claim publishing succeeded based only on a local commit or a successful push.
- Never force-push, rewrite shared history, or bypass branch protection. If a conflict, authentication failure, enforced approval restriction, or deployment failure prevents publishing, report the specific blocker and complete unaffected work.
- An explicit request to keep changes local, leave them uncommitted, or not publish overrides this standing authorization for that task.
- This publishing authorization does not authorize NAS deployment or changes to trading behavior, bot configuration, or paper trading state; those require authorization within the requested task's scope.

## NAS command boundary

- The NAS host has neither Python nor Docker Compose installed.
- Do not prescribe host `python`, `pip`, `docker compose`, or `docker-compose` commands for the NAS.
- Python is available inside the `traderouter-public` container. Use `docker exec` for NAS Python commands.
- Windows development tools are separate from the NAS host; a local Python installation does not imply Python exists on the NAS.
- For backend paths, rebuild commands, persistent storage, and secret setup, use the private instructions in `T:\AGENTS.md`.

## RRR.Trading v2
### Phase 2 — Asset Intelligence Card UI

- Frontend-only, read-only presentation. No backend deployment, strategy, selection, admission, sizing, execution, learning, or GO/NO-GO changes. Stop after Phase 2.
- Files: `asset-intelligence-modal.js`, `asset-intelligence-modal.css`, `asset-intelligence-modal.test.cjs`, `trading-universe.js`, `trading-universe.test.cjs`, `index.html`, and `demo/{15minbot,1hrbot,4hrbot}/index.html`, plus this documentation.
- One native dialog is shared by all four pages. Reuse through `data-intelligence-symbol="BTC"` on a button, or `window.AssetIntelligence.open(symbol, originatingElement)`. Do not introduce asset pages or menu items.
- Homepage Top-10 buttons now open the dialog instead of the old inline detail. Selection validation, ranking, refresh, card contents and five-column desktop layout are preserved. Hero asset chips also open it.
- Bot integration enhances asset labels in hero chips, universe cards, scan tiles, per-asset evidence headings, exit-monitoring headings and open/completed trade pair cells. A shared observer supports existing asynchronous rerenders; it does not change feed owners or trading decisions.
- Inspect the actual Phase 1 implementation before adapting shapes. The modal requests GET `/api/v2/intelligence/assets/{symbol}` (already includes `asset`, `overall_state` and a keyed `timeframes` object), plus GET `/api/v2/intelligence/assets/{symbol}/news` and `/events`. Separate `/state`, `/timeframes` and registry-list calls are unnecessary for this card. Confidence is a fraction in [0,1]. Never reuse legacy opportunity scores as v2 intelligence.
- Price comes from the existing GET `/api/market-summary`: matching symbol, USD currency, finite positive price, actual quote timestamp within two minutes and at most 30 seconds into the future. Missing/stale quotes display unavailable; quote source/time are separate from assessment generation.
- Displays overall and independent 15m/1h/4h bias, confidence, score, long/short permissions, state version, generated and record-updated timestamps. Missing generation and explicitly unavailable states do not become current assessments. UNKNOWN/UNAVAILABLE have neutral styling. Backend stale flags are honored; a saved generated assessment older than three timeframe intervals (45m/3h/12h; overall 12h) is marked stale as a UI freshness heuristic, not a trading rule. Registry selection freshness is identified separately.
- News/events display readable fields using text nodes, never raw JSON or HTML from the API. Empty collections, inactive collection sources, partial failures, 404 and unavailable API have distinct honest states. Requests are bounded to 15 seconds; close/switch abort pending requests and obsolete responses cannot replace the current asset. Retry is available after detail failure.
- Foundation-version metadata is labeled as schema/foundation information, not learned asset outcomes. Asset learning observations/performance are not inferred from the foundation's observation count.
- Accessibility: native modal semantics, named heading, real keyboard buttons, visible focus, focus on close at open, wrapped Tab/Shift+Tab, focusable details for scrolling, Escape/X/backdrop close, inert background, body-scroll restoration and return focus (including refreshed origin replacement). Backdrop close requires a pointer press and release outside the card.
- Desktop: centered, max-width 1000px, internal scrolling and three timeframe columns. Mobile: viewport-bounded width/height, one-column timeframes, wrapping text and sticky 44px close control. Existing navigation remains unchanged.
- Tests: `node asset-intelligence-modal.test.cjs` is self-hosted and covers correct symbols/endpoints, distinct timeframe states, populated/empty news/events, safe text, missing/partial/stale/503/404/loading states, price freshness, repeated open/close, synchronous close/reopen, BTC-to-ETH race cancellation, keyboard/focus/scroll restoration, X/Escape/backdrop, Top-10 refresh/five-column layout, all three bot pages and widths 320/375/768/1440. `trading-universe.test.cjs` updates the replaced inline-panel expectations; its ranking/expiry/malformed-data/layout checks remain. `short-technical-cards.test.cjs` also passes. Desktop/mobile screenshots are reviewed locally under ignored `.runtime/`.
- Regression limitations: historical homepage/navigation/bot tests retain assumptions about previously removed sections, navigation labels and numbered headings. Run and compare failures against untouched HEAD before attributing them to this phase; do not rewrite unrelated fixtures merely to make a blanket pass claim. The run confirmed the same baseline failures in `homepage.test.cjs`, `shared-header.test.cjs`, `public-presentation.test.cjs`, `decision-flow.test.cjs`, `completed-trades.test.cjs`, `exit-monitoring.test.cjs`, `15minbot.test.cjs` and `1hrbot.test.cjs` (including the existing 320px 1h-page overflow assertion). These failures remain unresolved in Phase 2.
- Frontend deployment: review task-only diff, commit these files with a conventional message, push normally to `origin/main`, confirm remote SHA, verify the matching GitHub Pages workflow succeeds, then verify live homepage Top-10 and symbol clicks plus bot dialogs at desktop/mobile sizes. A successful push or healthy API alone does not verify frontend publishing.
- Deferred: a consolidated reliable cross-bot current-position view; asset news/event ingestion and classification; real learning/outcome tracking; derivatives, horizon routing, allocation, strategy changes and all Phase 3 work. Existing position evidence remains on each bot page; this card never claims no active trade from missing status.


### Phase 3 — Asset-Specific News & Events

- Phase 3 adds trustworthy asset news/events only. The modal remains read-only; overall/timeframe assessments, selection, entries/exits, sizing, routing, GO/NO-GO, paper state and learning are unchanged. Stop after Phase 3.
- The backend consumes saved evidence from the existing public news/events collector: CoinDesk RSS, configured official project releases/advisories, and Solana status/maintenance. No duplicate collector, TradingView scraping, new credentials or macro/calendar integration. Homepage research remains unchanged.
- Pipeline: saved source evidence -> normalize identity/headline/available summary/URL/publication/discovery/type/provenance/text/hash -> current enabled v2 registry/profile mapping -> versioned deterministic classification -> deduplication -> persisted asset_news/asset_events -> separate news summary -> existing GET v2 API -> shared modal. Legacy market-expanded asset lists, directions and scores never enter v2 classifications.
- Profiles provide identity aliases, protocols, organizations, ecosystems and explicit private dependency/sector/regulatory terms. Direct identity relevance is 0.95, ticker 0.92, official project source 0.90, description 0.70, organization 0.65, ecosystem 0.50, documented relationship/comparator 0.45. Minimum persisted relevance: 0.40. Generic crypto/macro stories are not mapped to every asset. Ambiguous ordinary-word names require explicit ticker notation or reviewed aliases.
- Direction uses BULLISH/BEARISH/NEUTRAL/MIXED/UNKNOWN. Conservative asset-local phrases determine direction; proposals, negation, questions and indirect organization exposure stay UNKNOWN. Relevance, expected impact [0,1], classifier confidence [0,1], source health and future trading weight remain separate. Confidence is a rule confidence indicator, not calibrated accuracy or a success probability.
- Controlled types: REGULATORY, ETF, NETWORK_UPGRADE, NETWORK_OUTAGE, SECURITY_EXPLOIT, TOKEN_UNLOCK, TOKEN_BURN, PARTNERSHIP, PROTOCOL_UPGRADE, ECOSYSTEM_GROWTH, DEVELOPER_ACTIVITY, EXCHANGE_LISTING, EXCHANGE_DELISTING, LIQUIDITY, WHALE_ACTIVITY, INSTITUTIONAL_FLOW, FUNDING_OR_DERIVATIVES, LEGAL, GOVERNANCE, ADOPTION, MACRO_SPILLOVER, MARKET_STRUCTURE, OTHER. Labeling a derivatives-related headline does not implement derivatives intelligence.
- Only discrete evidenced actions/official structured records create events. Publication time never substitutes for unknown event time. Prereleases do not create events; software releases do not prove network activation; vulnerability advisories do not prove exploitation.
- Deduplication uses source identity, canonical URL, normalized headline hash within 24h and conservative near-identical wording with preserved numeric/entity/action facts. One current mapping per story/asset; normalized source revisions and version/profile/input-hash classification audit are retained. Repeated polls do not duplicate records; corrected/withdrawn current mappings can be removed without losing audit evidence.
- Classifier: asset-news-v1. API/schema versions: 2.1.0-phase3 / 2 (transactional additive migration). Existing GET endpoints retain their shapes and add news_summary on detail/state/collections, news fields on overall_state, classifier metadata/source links/evidence freshness, and news_intelligence on health. Overall/timeframe availability stays independent and unavailable until separately implemented.
- News aggregation uses relevance × impact × confidence × 2^(-ageHours/halfLifeHours); signed bullish/bearish values are +1/-1, neutral/mixed 0, UNKNOWN has no invented direction. News score [-1,+1] is signed weighted signal / all eligible weights; unknown evidence dilutes the score. Mixed opposing evidence is labeled MIXED. All-unknown/empty/stale inputs retain null score/confidence. Weighted impact is separate and may exceed 1 across stories.
- Default recency: 24h half-life, 72h window, configurable server-side. Original timestamps survive polling. The saved-feed consumer runs automatically every 300s, with persisted counters/errors/source health/classifier version; its run becomes stale after 900s. Upstream source freshness expires after 2h. Request-time freshness/recency checks do not require upstream I/O.
- UI files: asset-intelligence-modal.js/.css/.test.cjs plus modal script versions on the homepage and all three bot pages. Small additive news summary, collection/evidence freshness, classifier version, safe HTTPS source links and honest unknown event timing. All text uses text nodes. Existing Phase 2 modal/navigation/accessibility behavior is preserved.
- Verification: deterministic backend fixtures include BTC/ETH/XRP/SOL, mappings/threshold/different relevance/direction/taxonomy/impact/confidence, dedup/polling/revisions/profile changes, recency/stale/empty/error/malformed feeds, migration/API/version metadata and no trading writes. Modal tests retain 320/375/768/1440, race/focus/close/scroll/unavailable checks and add Phase 3 rendering/source-link safety. Ranking and short technical-card regressions also pass. Historical regression limitations above remain; do not rewrite unrelated fixtures to claim a blanket pass.
- Deployment must separately verify backend image/rebuild/persistence/protected bot configuration and frontend GitHub Pages commit/workflow/live modal. A local real-feed preview is not deployed intelligence. Backend deployment instructions/evidence stay in the private workspace. Frontend uses the standing task-only commit/push authorization.
- Limitations: saved RSS evidence currently contains headlines without article bodies; direction is often honestly UNKNOWN. Relationships beyond maintained identities require reviewed profile metadata. No general macro broadcast, reliable economic calendar, LLM, self-learning, calibrated outcome probabilities or classification perfection is claimed. Phase 4 remains deferred: derivatives assessments, horizon/selection/allocation/risk/execution changes, learned weights/outcomes/counterfactuals and automatic model promotion.
