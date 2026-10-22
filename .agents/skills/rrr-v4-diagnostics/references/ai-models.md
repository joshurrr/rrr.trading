# AI models and budgets

Topic: `ai-models`. Read the common workflow in [SKILL.md](../SKILL.md).
**B** below means `S.evidence.budget`. Tasks/roles, configured models, historical
selected/resolved models and providers are separate dimensions. Never permanently
bind a role to a particular model or attribute old requests to today's routing.

## Actual budget fields

- `B.status`: `OK`, `WARNING`, `EXHAUSTED`, `UNKNOWN`, distinct from `S.status`.
- `scope=SHARED`, `currency`, `accounting_period`, `availability`,
  `configured_limit_usd`, `configured_limit_evidence`, `limit_usd`, `limit_source`,
  `limit_recorded_at`, `spent_usd`, `remaining_usd`, `percentage_used`,
  `status_basis`, `billing_basis`.
- `attribution`, `period_coverage`, `window_spent_usd`, `unattributed_task_window_usd`,
  `reconciliation_delta_usd`, `source` (`provenance`, `period_basis`,
  `rows_available`, `rows_examined`, `max_rows`, `max_source_bytes`), `missing_evidence`.
- `tasks[]`: `task`, `configured_model`, `configured_provider`,
  `configuration_evidence`, `recorded_models`, `actual_models`,
  `recorded_providers`, `denials`, `last_denial_cycle_started_at`, plus group fields.
- `models[]`: historical `model`, `provider`, plus group fields. `providers[]`
  groups the same spending by recorded provider. UNKNOWN attribution stays UNKNOWN.
- Group fields: `window_events`, `window_requests`, `period_requests`,
  `window_spent_usd`, `period_spent_usd`, `window_successes`, `window_failures`,
  `window_unknown_outcomes`, `last_successful_request`,
  `last_failed_or_rejected_request`, `history_scope=BOUNDED_LEDGER_WINDOW`.
- `recent_failures[]`: `timestamp`, `task`, `selected_model`, `actual_model`,
  `model`, `model_basis` (`RESOLVED`, `SELECTED_ONLY`, `UNKNOWN`), `provider`,
  `status`, `request_error`, `successful`, `cost_usd`.
- `recent_restrictions[]` and task `denials[]` contain saved controller summaries:
  `timestamp`, `timestamp_basis=CONTAINING_CYCLE_START`, `task`, `status`,
  `request_error`, `budget_usd`, `monthly_spending_usd`, `remaining_budget_usd`,
  `assessment_cost_usd`, `next_eligible_at`. Containing cycle start is not exact
  request/denial time. Task can be null where the controller did not retain it.

Legacy `S.evidence.assignments`, `luna`, `sol_outcomes` and `sol_budgets` remain.
Use specific saved Luna validation/failure reasons and SOL errors as supporting
evidence; they do not imply a particular model assignment or budget cause.

## Investigate

1. Establish `accounting_period`, availability, source scope and timestamps.
   The ledger's maintained shared total includes reservations/local accounting;
   `billing_basis` does not claim provider-confirmed billing. V4 API spending and
   Codex credits/usage limits are separate; never infer either from the other.
2. Compare `spent_usd` only with an applicable recorded controller `limit_usd`.
   `configured_limit_usd` is SOURCE_CONFIRMED configuration, not a verified running
   limit. Remaining/percentage stay null without current-period totals and an
   effective recorded limit. Do not assume independent role/task budgets:
   `independent_task_limits_not_recorded` is explicit. Zero and null differ.
3. `EXHAUSTED` requires recorded spending at/above a saved applicable limit or a
   latest saved `BUDGET_EXHAUSTED` denial without a later recorded request. This is
   saved evidence, not proof that a restriction is still active now. A reservation
   allowance can cause denial before spending reaches the limit. Inspect the
   controller timestamp and `status_basis`; do not infer exhaustion from
   `ai_unavailable`, `assessment_stale`, `llm_response_failure` or a generic error.
4. Separate restrictions: `NOT_DUE`/`assessment_not_due` is cadence;
   `EVENT_LIMIT` is an event restriction; `LOCKED` is controller contention;
   `EVIDENCE_ALREADY_ATTEMPTED` is an unavailable reuse result. `REUSED` is not a
   new paid request. Reservation/settlement states (`RESERVED`,
   `USAGE_UNKNOWN_RESERVED`, `ALLOWANCE_EXCEEDED`, `SETTLEMENT_FAILED`) do not
   independently prove monthly exhaustion. `ACCOUNTED` is not validated success.
5. For provider/model/task failures, correlate `recent_failures` with historical
   `model`, `model_basis`, provider, task and time. `API_ERROR` and
   `INVALID_RESPONSE` are safe recorded categories; do not guess provider quota,
   billing or rate-limit causes. Missing history/costs remain UNKNOWN rather than zero. Missing historical provider remains UNKNOWN,
   even when `configured_provider` is known. A selected model is not a confirmed
   resolved model. Null outcome means validated success was not recorded.
6. Task/model/provider totals are alternative views of the same spending, never
   additive. `period_coverage` describes financial reconciliation; `attribution`
   also requires recorded task, actual-model and provider identifiers for COMPLETE.
   Multiple models can serve one task within a period. The projection
   examines only the last 200 rows from a source capped at 2 MiB; 40 groups per
   dimension are returned. Period group totals/counts are null unless the bounded
   window fully reconciles with maintained spending. Use window figures only for
   their stated scope; do not reconstruct complete history from recent failures.
7. Honour `period_attribution_incomplete`, `request_window_truncated`,
   `historical_task_not_recorded`, `historical_model_not_recorded`,
   `historical_provider_not_recorded`, `request_history_not_recorded`,
   `validated_request_outcome_not_recorded`,
   `effective_runtime_limit_not_recorded` and output/group truncation gaps.
   Failed refreshes can still lose controller details. If more evidence is needed,
   request only relevant existing sanitised report fields, not full budget files.

Recommend the smallest evidence-backed correction or safe instrumentation gap.
Never switch models/providers, alter pricing/enforcement, reset budgets, call AI,
force request reuse, restart services or change trading as part of diagnosis.
