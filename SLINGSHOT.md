# Slingshot

Experimental paper-only fourth bot, with an independent wallet, positions and
trade history. Dashboard: `/demo/slingshot/`. Its native runtime is separate from
the three existing strategies. Frontend publication does not start the bot.

Entry consumes the shared saved decision and sizing evidence. A current GO,
aligned VALID 15m/1h/4h assessments, existing score/confidence thresholds and
available news, macro and market context are required. Missing or conflicting
inputs block entry. Scores and confidence are heuristics, not success probabilities.
The existing approved notional is retained: at 2× leverage, half as much margin
is used. No larger exposure is inferred from confidence.

Requested defaults: 2× leverage, 0.6% underlying initial stop. Trailing begins at
0.5% favourable movement with a 0.4% distance; at 1%, 2% and 3%, the distances
are 0.6%, 0.8% and 1%. LONG stops never fall; SHORT stops never rise, including
when a distance increases or the native process restarts. Native current-price
loops manage stops independently of candle closes and intelligence API outages.
Fresh opposing 15m/1h technical evidence plus an opposing 1h market move can exit
early. There is no fixed take-profit target.

The dashboard uses owning native paper status and independent current-run
reporting. Missing/stale data never implies an empty account. It shows actual
native leverage/P.L, stops, entry evidence and evaluation observations; running
settings remain unavailable until native evidence verifies them. Native recorded
costs remain part of P.L; stop percentages are not guaranteed realized loss limits.

A 10% win rate requires average net winners greater than nine times average net
losses to break even. Higher leverage alone does not improve that payoff ratio.
Tight trailing protection may prevent large winners from developing; paper results
must establish whether the experiment achieves its intended payoff distribution.

Focused checks: `slingshot.test.cjs` covers four widths (320/375/768/1440), LONG/
SHORT positions, safe text, asset dialogs, empty/stale/outage states, navigation,
the fourth overview card and GET-only requests. Private strategy/configuration,
backend tests and guarded operator deployment stay outside this repository.

15 October 2026 presentation refresh: visible Slingshot identity and paper label,
three timeframe chips, a separate runtime status notice, ten bordered performance
cards, grouped strategy/evaluation panels and dedicated position/history panels.
The requested trailing schedule remains distinct from verified running settings.
Loading, empty and unavailable panels have explicit presentation states; reporting
acceptance, freshness checks, endpoints, polling and trading behavior are unchanged.
The focused browser checks pass at all four widths; desktop/mobile unavailable
screenshots were reviewed locally under ignored `.runtime/slingshot/`.

Deployment status: source prepared; NAS operator build/start and real-feed
verification are pending. Local fixtures do not establish a running bot or
functioning production inputs.
