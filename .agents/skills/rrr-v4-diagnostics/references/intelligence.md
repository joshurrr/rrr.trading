# Intelligence

Topic: `intelligence`. Read the common workflow in [SKILL.md](../SKILL.md).

## Actual fields

- `S.evidence.luna`: `status`, `last_successful_execution`,
  `last_failure_reason`, `failure_cycle_started_at`, `validation_reason`,
  `evidence_at`, `evidence_freshness`, `reasons`,
  `usable_evidence_reaches_sol`, `source`, `scope`.
- `S.evidence.research`: `status`, `evaluated_at`, `researched_assets`,
  `source_timestamp`.
- `S.evidence.coverage`: `crypto_market_measurements`, `news`, `bybit_breadth`,
  `fear_greed`, `macro`, `fred`, `nasdaq100`, `sp500`, `futures`,
  `equities_and_economic_events`.
- `S.sources.sentiment`: `timestamp`, `status`, `freshness`, `provenance`;
  `S.sources.cycle`: `timestamp`, `availability`, `provenance`.

## Investigate

1. Compare retained assessment/evidence time with the cycle and failed refresh's
   containing cycle. `last_successful_execution` is a retained validated
   assessment, not a full success history. A failed refresh may leave it intact.
   Nested Luna statuses can be `HEALTHY`, `DEGRADED`, `FAILED`, `UNKNOWN`; do not
   replace them with the outer topic classification.
2. Read specific `reasons`: `assessment_stale`, `assessment_missing`,
   `assessment_entry_expired`, `assessment_provenance_missing`, or
   `evidence_expired_or_unsupported:<ref>`. Preserve reference IDs and saved
   freshness; do not invent a provider outage from missing/stale evidence.
   `assessment_not_due` is pacing. A null research count is not zero coverage.
3. For `invalid_llm_output`, inspect `validation_reason`. A precise validator
   code identifies the failed rule, not necessarily its underlying cause.
   Generic `llm_response_failure` does not identify rate limits or model defects.
   Use [AI models](ai-models.md) only for a related request/budget issue.
4. `usable_evidence_reaches_sol` is the existing latest-cycle projection of a
   matching USABLE/CURRENT assessment plus an OBSERVED SOL decision. True is not
   a per-request acknowledgement; false means those conditions were not all met;
   null is insufficient evidence. Freshness alone does not establish consumption.
   Use [Trading](trading.md) only when SOL outcome evidence is needed.
5. Read coverage values literally. FRED cash-index evidence does not prove a
   futures or economic-events feed. News citations do not verify collector
   execution health. `news_collection_failure_history_not_persisted` and
   `macro_worker_health_unknown` are observability gaps, not confirmed failures.

Recommend the smallest evidence-backed correction or missing safe telemetry.
Do not trigger collection, refresh Luna, regenerate assessments or alter policy.
