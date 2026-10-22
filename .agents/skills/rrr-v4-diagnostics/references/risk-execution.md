# Risk and execution

Topic: `risk-execution`. Read the common workflow in [SKILL.md](../SKILL.md).

## Actual fields

- `S.evidence.monitoring`: `status`, `evaluated_at`, `requested_positions`,
  `monitored_count`, `unmonitored`, `reasons`. Unmonitored rows expose identity,
  `position_id` and `reasons` when available.
- `S.evidence.outcomes[]`: `timestamp`, `symbol`, `decision`, `ai_status`,
  `execution`, `error`, `rejection`, `stop_loss`, `take_profit`, `fill_price`,
  `quantity`, `leverage`, plus other saved decision fields.
- `S.evidence.open_positions[]`: `id`, `exchange`, `symbol`, `instrument_type`,
  `side`, `quantity`, `entry_price`, `entered_at`, `protective_stop`, `leverage`,
  `availability`, `current_mark`, `unrealized_pnl`, `last_known_mark`,
  `last_known_unrealized_pnl`, `mark_observed_at`, `mark_expires_at`.
- `S.sources.account` and `S.sources.cycle` preserve source availability/time.

## Investigate

1. Compare monitoring `evaluated_at` and coverage counts with the saved cycle and
   account timestamps. Monitoring `OK` concerns that saved evaluation only.
   `NOT_RUN`, `UNAVAILABLE`, `ATTENTION`, null counts and zero positions are
   distinct. Identify recorded unmonitored positions without inventing coverage.
2. Inspect exact outcome `error`/`rejection` codes, including
   `protective_stop_invalid`, `take_profit_invalid`, `take_profit_tick_invalid`,
   `leverage_limit_exceeded`, `position_limit_reached`, `insufficient_collateral`,
   `order_quantity_invalid`, `order_precision_invalid`,
   `duplicate_instrument_exposure`, `price_unavailable`, `constraints_unavailable`.
   A rejection proves the saved reason, not a failure of the risk control itself.
3. Separate proposed `stop_loss`/`take_profit` from a position's saved
   `protective_stop`. A saved stop or TP proposal does not prove an exchange
   order, current monitoring health, or a successful exit. Preserve paper mode.
4. Compare mark timestamps/expiry and `availability`. Keep stale last-known
   values separate from current valuation; do not recalculate risk approvals.
   `ADMITTED` is not a fill; `OPENED`/`CLOSED` describes saved paper outcomes.
5. Respect `independent_risk_validation_health_unknown`,
   `take_profit_monitoring_health_unknown` and `exit_history_not_loaded`.
   If an exit investigation needs detail, request only relevant sanitised
   `completed_trades` from existing GET `/v4/paper` (including `closed_at`,
   `exit_reason`, `exit_price`, `net_pnl`), not full account/state files.

Recommend a narrow correction only where evidence supports it. Never close a
position, modify protection, reset reservations, or disable existing monitoring.
