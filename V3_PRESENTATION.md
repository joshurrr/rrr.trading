# RRR.Trading V3 presentation

The homepage and three PAPER bot pages require a verified V3 generation before
showing trading information. The read-only generation feed distinguishes fresh
collection, held verification, active PAPER trading, failed restart and unavailable
evidence. Rebuild/failure/unverified states withhold the main dashboard.

A changed factory-start identity reloads only the page or Radio RRR content frame,
so earlier in-memory feeds cannot reappear as V3 evidence. Current-run performance
also requires the generation's exact `v3-paper-*` identity and a matching start
date. Existing native trade timestamp and stale-response safeguards remain.

The banner reports tested leverage of 1x. Confidence leverage between 1x and 2x
and a new independent SHORT model are explicitly inactive. Backend API/schema
version identifiers remain separate from the V3 installation identity.

Verification: identity/legacy/timezone/future-time unit fixtures, existing run
isolation fixtures, and all four pages at 320/375/768/1440 with active, rebuilding,
failed and unavailable generation evidence. Tests use mocked API data; they do
not establish that a backend reset or intelligence collection has occurred.
