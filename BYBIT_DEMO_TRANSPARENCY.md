# Public Bybit Demo transparency

The 15-minute bot page has a separate, read-only **Bybit Demo copier** panel.
It is labelled **SIMULATED FUNDS** and never combines exchange demo evidence
with the existing paper strategy results. Its status remains visible when the
independent paper feed is unavailable. Other bot pages are unchanged.

The panel reads only GET `/api/demos/short/bybit-demo`, without credentials.
The saved feed contains no API key, secret, account identity, full account balance,
private configuration or controls. It displays the configured simulated budget,
connection/execution status and last saved check in Australia/Brisbane.

The current version, `bybit-demo-public-v1`, supports the connected but disabled
setup. The order executor is not implemented, so performance, positions and fills
are explicitly **not started**, with null result values. No zero-profit claim,
simulated return, estimated fill or paper result substitutes for exchange evidence.
Actual execution reporting will require a new validated contract when it exists.

The browser polls every 30 seconds while visible, bounds requests to 10 seconds
and expires evidence after 90 seconds. Missing, stale, failed, malformed, future,
unsupported-version and inconsistent execution data cannot become a running or
verified-performance claim. Saved budgets are identified when status is stale.
Rendering uses text nodes; this view contains no forms or trading controls.

Files: `demo/bybit-demo.js`, `.css`, `.test.cjs` and the 15-minute page include.
Focused browser tests cover the real radio navigation frame at 320/375/768/1440,
unavailable paper data, labels, budget, null results, stale/future/malformed/error
states, safe text and GET-only requests. Screenshots remain under ignored `.runtime/`.

Frontend publication and backend installation are separate. Until the saved-feed
backend update is installed, the published panel correctly reports unavailable.
Private source, credentials and backend installation evidence stay outside this
frontend repository. No execution, strategy, sizing, positions or paper statistics
are changed by the transparency panel.
