# Economic event protection — Phase 4, 10 October 2026

The shared shadow engine and frontend are implemented and locally verified.
**Backend deployment is pending: NAS SSH refuses connections.** Independent public
checks still return 404 for the new protection endpoints. Production SHADOW mode
and saved worker integration are therefore not yet confirmed. Frontend publication
is verified separately in the completion response. Phase 3 risk awareness remains
available independently; the new panels show protection unavailable until deployed.

## Architecture and controls

One private backend worker reuses the saved economic-calendar-v2 evidence and
economic-event-risk-v1 calculations. There is no new collector, FRED integration,
subscription or trading strategy. All three PAPER bots share the same evidence;
private bot-specific window overrides are supported.

Defaults are protection enabled, SHADOW mode, entry enforcement disabled,
observational position monitoring enabled and automatic economic exits disabled.
This phase rejects configuration attempts to activate enforcement or exits.
Future activation requires a separately authorized implementation and review;
tests never advance the rollout automatically.

| Setting | Default |
| --- | --- |
| Advance warning / high alert | 60 / 30 minutes |
| Proposed entry window | 30 minutes before through 15 minutes after scheduled release |
| Scheduled active / post-event monitoring window | 15 minutes / 4 hours |
| Earliest evidence-based recovery observation | 30 minutes after scheduled release |
| Calendar / bounded outage extension | 24 hours / 2 hours from original evidence validity |
| Worker / policy validity | 30 / 90 seconds |
| Native position observation validity | 30 seconds |
| Initial systemic rules | US CPI, US Employment Situation, Fed policy decisions |

HIGH impact alone does not create a protection window. Reviewed systemic identity,
official verified time and fresh or explicitly bounded retained evidence are required.
Date-only announcements remain visible with their source date/timezone and
TIME NOT VERIFIED; they create no countdown restriction. NORMAL describes absence
of a known configured window within partial evidence, never market safety.

States are NORMAL, ADVANCE WARNING, HIGH ALERT, EVENT ACTIVE, POST-EVENT MONITORING,
RECOVERY and UNASSESSED. Overlapping windows are combined. Confirmed cancellations
and healthy rescheduling supersede old timing. Outages cannot erase a previously
verified imminent window within its bounded validity, and cannot produce indefinite
restrictions. Scheduled clock passage never proves publication or economic causation.
RECOVERY requires fresh position/market observations, lower observed volatility
and no observed deterioration; elapsed time alone cannot establish recovery.

The authenticated final PAPER admission path revalidates local policy evidence and
records it in the existing atomic admission audit. It does not vote on admission,
alter quantities or call an external calendar API. A separate bounded queue feeds
shadow health/acknowledgement observations. Queue failures are exposed; atomic
admission audit evidence remains independent of the queue. Public GETs perform no
collection, database writes or trading calls.

Existing native status, analyzed closed-candle exit telemetry and saved market
snapshots supply position observations. Multi-input adverse movement, volatility,
stop distance and existing technical deterioration can identify a protective action
candidate. It remains observational. Existing strategy exits, stop execution, ROI,
trailing orders, leverage, sizing, gates, selection and PAPER run statistics retain
their owners and behavior. Unsupported or stale inputs remain unavailable.

## Frontend and API

Files: economic-protection.js/.css/.test.cjs; script/style references on all three
bot pages, Schedule and Tools; Schedule's GET allowlist fixture; this document,
SCHEDULE.md and AGENTS.md. Backend source, configuration, databases, deployment
guards and detailed architecture evidence remain in the private workspace.

Read-only endpoints are GET /api/schedule/protection,
/api/schedule/protection/health and /api/demos/{short,medium,long}/economic-protection.
Version: economic-protection-v1. The existing Phase 3 risk endpoints/panels remain
independent. Bot pages show backend mode, states, proposed restrictions and
observational warnings alongside existing exit monitoring. Schedule has a compact
shared status with bot links. Tools extends its existing collapsed calendar panel
with snapshot/logging/mode health and authenticated admission observation freshness.
No recent admission acknowledgement is not proof that a bot failed to evaluate.

All text uses text nodes; links to bot pages are fixed local routes. Each protection
panel has one GET loop, a 12-second timeout and 30-second refresh. Policy claims
expire independently after 90 seconds. Failed, malformed, future or expired
responses remove current restriction and position-monitoring claims. Disabled
configuration remains distinct from degraded/unavailable evidence.

## Verification and limitations

65 new focused backend/guard tests pass. Final affected PAPER admission checks pass;
the established 557-test runner passes with two existing skips and its original
Windows lifespan/source-allowlist exclusions. Other affected calendar, decision and
native-exit tests passed. No unrelated historical fixture was rewritten.

The new browser suite passes for all bots, Schedule and Tools at 320/375/768/1440:
states, shadow labels, position warnings, Brisbane times, date-only evidence,
outage retention, missing positions, stale/expired/future/malformed/loading/timeout
responses, safe text, keyboard controls and GET-only requests. Phase 3 risk,
Schedule, Tools, bot summary, native exit telemetry, navigation, ranking and short
technical-card regressions pass. Screenshots were reviewed and remain ignored.

A real public-calendar isolated preview is fresh but UNASSESSED for all three
policies: the seven returned configured critical records have date-only timing,
with zero verified intraday windows. This is a preview, not a deployed worker or
forward shadow observation. Counts are verification snapshots, not constants.

Consensus surprise remains unavailable: the calendar supplies no verified actual /
consensus pair with matching units and periods. Previous revised FRED values never
substitute for consensus. Reaction monitoring works independently of surprise.
Private forward evaluation associates only observations made before actual
authorization/closure with confirmed PAPER outcomes and native exit reasons.
Risk-adjusted impact, protective-exit counterfactual fills and historical replay
benefits remain unavailable without reliable denominators, fills and original
information vintages. No live improvement or announcement causation is claimed.

The guarded deployment prepares consistent intelligence/native backups, exact
installed and tested image checks, unchanged protected bot/configuration/PAPER
baselines, stopped canonical preflight, API-only replacement and independent public
SHADOW verification. It preserves the unrelated pending monitoring source. No NAS
deployment, API restart, bot restart, live enforcement, economic exit, position
closure, balance/statistics reset or strategy change was performed by this task.
Phase 4 deployment acceptance remains outstanding until that operator process passes.
