# RRR Trading

Systematic medium-term trading platform, powered by **TradeRouter**.

## v0.1
- Static GitHub Pages front end
- Paper-mode dashboard concept
- Market candidate scoring UI
- TradeRouter event log concept
- No live trading or exchange connectivity yet

Custom domain: https://rrr.trading

## Homepage and public demo

The static homepage uses `https://api.rrr.trading/status`, `/score` and
`/market-regime` with no-store requests, 10-second timeouts and a 30-second
refresh after requests complete. Hidden tabs skip polling. Endpoint failures
clear the affected panel without hiding other available data.

`demo/index.html` serves the public `/demo` route from the repository root.
`website/demo/index.html` is the original reference copy; deploy the root site.
No trading configuration or API implementation is changed by the homepage.

The daily report fragment is a labelled template until a real briefing is
published. Existing archive entries remain labelled examples. Score sentiment
provenance is displayed, including placeholder/manual inputs. The proposed
Bybit/4h configuration and leverage ladder are explicitly presented as plans.

Validation: serve the root with `python -m http.server 8765`, then run
`node homepage.test.cjs` with Playwright installed and Microsoft Edge available.
The browser test intercepts API requests with test-only fixtures and checks
responsive widths, risk-blocked recommendations, missing values, partial and
complete API outages, score expansion, radio defaults and `/demo` routing.
Screenshots are written to the OS temporary directory.

Deployment follow-up: `/status`, `/score` and `/market-regime` returned HTTP 404
when checked on 30 September 2026. Restore those public routes and verify CORS
allows `https://rrr.trading` before expecting current data to appear.
