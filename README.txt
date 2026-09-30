TradeRRR clean site/API split
==============================

PUBLIC WEBSITE
--------------
Share this with people:
    https://rrr.trading/demo

Deploy:
    website/demo/index.html
to:
    <GitHub Pages repo>/demo/index.html

That page reads live data from:
    https://api.rrr.trading/status

PUBLIC API
----------
Machine endpoints:
    https://api.rrr.trading/status
    https://api.rrr.trading/health
    https://api.rrr.trading/score
    https://api.rrr.trading/score/BTC
    https://api.rrr.trading/market-regime

The API host no longer needs to serve an HTML /demo page.

API INSTALL
-----------
Place these files beside traderouter-public main.py:
    scoring.py
    score_routes.py
    install_api_clean_split.py

Then:
    python3 install_api_clean_split.py /path/to/main.py

Rebuild/restart traderouter-public using your existing Docker procedure.

TEST
----
curl -s https://api.rrr.trading/health
curl -s https://api.rrr.trading/status | python3 -m json.tool
curl -s https://api.rrr.trading/score/BTC | python3 -m json.tool

Then browse:
    https://rrr.trading/demo

CORS
----
Your existing API already allows:
    https://rrr.trading
    https://www.rrr.trading
so the GitHub Pages demo can call api.rrr.trading directly.
