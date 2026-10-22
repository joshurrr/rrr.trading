# Trading

Topic: `trading`. Read the common workflow in [SKILL.md](../SKILL.md).

## Actual fields

- `S.evidence.trading`: `worker_status`, `open_positions`, `entries_enabled`,
  `entry_blocking_reasons`, `sol_decisions_evaluated`, `sol_decision_counts`
  (`LONG`, `SHORT`, `NO_TRADE`).
- `S.evidence`: `source_results`, `projected_results`, `outcomes_scope`,
  `valid_sol_decisions_in_projected_results`, `sol_outcomes[]`.
- Each outcome includes `timestamp`, `symbol`, `decision`, `ai_status`,
  `execution`, `budget_status`, `error`, `rejection`, `evidence_refs`, `model`,
  `cost_usd` and saved proposal/fill fields.
- `S.sources.cycle`: `availability`, `timestamp`, `provenance`;
  `S.sources.account`: `availability`, `timestamp`, `provenance`.

## Investigate

1. Establish the saved cycle's age/availability before interpreting counts.
   `worker_status` is a saved cycle result, not current scheduler liveness.
2. Read the entry switch and exact blocking reasons: e.g. `entries_disabled`,
   `entry_configuration_missing`, `account_unavailable`, `research_failed`,
   `position_monitoring_incomplete`, `ai_unavailable`. An entry-only disablement
   does not disable monitoring/exits. Enabled entries do not establish capacity
   or admission for any asset.
3. Distinguish result rows from valid SOL decisions. `sol_decisions_evaluated`
   counts saved result rows; it does not prove that each contains a valid decision.
   Decision counts and `valid_sol_decisions_in_projected_results` cover projected
   rows, at most the first 50. Compare `source_results`, `projected_results`,
   `outcomes_scope` and truncation gaps before generalising. Preserve zero vs null.
4. Inspect each relevant `ai_status`, `decision`, `budget_status`, `error` and
   `rejection`. `NO_TRADE` can be a valid successful evaluation. A LONG/SHORT
   proposal or `ADMITTED`/`ALREADY_ADMITTED` is not proof of a fill; saved
   `OPENED`/`CLOSED` records establish simulated paper execution at their scope.
   Outcome `timestamp` is an AI evaluation time, not necessarily a fill time.
5. For `ai_unavailable` or zero valid decisions, use specific saved failures or
   [AI models](ai-models.md) evidence rather than assuming exhaustion/provider
   failure. For admission/position issues, load [Risk & execution](risk-execution.md).

`per_asset_capacity_skips_not_persisted` and `no_complete_decision_history` mean
missing historical explanations. Current position count cannot prove the count
at decision time. Do not reconstruct approvals, force entries or change rules.
