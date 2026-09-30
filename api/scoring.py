from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
import json
import os
import time


# TradeRRR Score API v1
#
# This module DOES NOT place trades.
# It converts four independent 0-100 component scores into:
#   - direction
#   - final confidence
#   - leverage recommendation (0x to 2x)
#   - trade_allowed
#
# Default weights agreed for v1:
#   technical: 40%
#   daily trend/regime: 25%
#   news/sentiment: 20%
#   risk conditions: 15%
#
# Risk is intentionally asymmetric:
# severe risk can veto/cap leverage, while positive news cannot
# independently force a trade.

WEIGHTS = {
    "technical": 0.40,
    "trend": 0.25,
    "sentiment": 0.20,
    "risk": 0.15,
}

DEFAULT_INPUTS_PATH = Path(
    os.getenv("TRADERRR_SCORE_INPUTS", "/data/score_inputs.json")
)

DEFAULT_ASSETS: dict[str, dict[str, Any]] = {
    "BTC-USDT": {
        "direction": "LONG",
        "technical_score": 70,
        "trend_score": 70,
        "sentiment_score": 50,
        "risk_score": 70,
        "sentiment_source": "placeholder",
    },
    "ETH-USDT": {
        "direction": "LONG",
        "technical_score": 68,
        "trend_score": 67,
        "sentiment_score": 50,
        "risk_score": 70,
        "sentiment_source": "placeholder",
    },
    "SOL-USDT": {
        "direction": "LONG",
        "technical_score": 65,
        "trend_score": 64,
        "sentiment_score": 50,
        "risk_score": 65,
        "sentiment_source": "placeholder",
    },
}


@dataclass
class AssetScore:
    pair: str
    direction: str
    technical_score: float
    trend_score: float
    sentiment_score: float
    risk_score: float
    confidence: float
    leverage: float
    trade_allowed: bool
    risk_gate: str
    sentiment_source: str
    generated_at: float


def _clamp(value: Any, low: float = 0.0, high: float = 100.0) -> float:
    try:
        value = float(value)
    except (TypeError, ValueError):
        value = 50.0
    return max(low, min(high, value))


def leverage_for_confidence(confidence: float) -> float:
    """Map confidence to leverage. Hard maximum is 2.0x."""
    c = _clamp(confidence)
    if c < 55:
        return 0.0
    if c < 65:
        return 1.0
    if c < 75:
        return 1.25
    if c < 85:
        return 1.5
    if c < 93:
        return 1.75
    return 2.0


def score_asset(pair: str, inputs: dict[str, Any]) -> AssetScore:
    technical = _clamp(inputs.get("technical_score"))
    trend = _clamp(inputs.get("trend_score"))
    sentiment = _clamp(inputs.get("sentiment_score"))
    risk = _clamp(inputs.get("risk_score"))

    confidence = round(
        technical * WEIGHTS["technical"]
        + trend * WEIGHTS["trend"]
        + sentiment * WEIGHTS["sentiment"]
        + risk * WEIGHTS["risk"],
        1,
    )

    direction = str(inputs.get("direction", "FLAT")).upper()
    if direction not in {"LONG", "SHORT", "FLAT"}:
        direction = "FLAT"

    leverage = leverage_for_confidence(confidence)
    risk_gate = "normal"

    # Risk is allowed to veto more strongly than good sentiment is allowed
    # to boost the trade.
    if risk < 25:
        leverage = 0.0
        risk_gate = "blocked"
    elif risk < 40:
        leverage = min(leverage, 1.0)
        risk_gate = "max_1x"
    elif risk < 55:
        leverage = min(leverage, 1.25)
        risk_gate = "max_1.25x"

    # FLAT is always non-trading regardless of score.
    trade_allowed = direction in {"LONG", "SHORT"} and leverage > 0

    return AssetScore(
        pair=pair.upper(),
        direction=direction,
        technical_score=technical,
        trend_score=trend,
        sentiment_score=sentiment,
        risk_score=risk,
        confidence=confidence,
        leverage=round(leverage, 2),
        trade_allowed=trade_allowed,
        risk_gate=risk_gate,
        sentiment_source=str(inputs.get("sentiment_source", "placeholder")),
        generated_at=time.time(),
    )


def load_inputs() -> dict[str, dict[str, Any]]:
    """
    Load manually supplied score inputs when present.

    Expected shape:
    {
      "BTC-USDT": {
        "direction": "LONG",
        "technical_score": 82,
        "trend_score": 88,
        "sentiment_score": 71,
        "risk_score": 76,
        "sentiment_source": "daily_report"
      }
    }

    Until the news/market-data engines are connected, defaults are used.
    """
    if not DEFAULT_INPUTS_PATH.exists():
        return DEFAULT_ASSETS.copy()

    try:
        raw = json.loads(DEFAULT_INPUTS_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            return DEFAULT_ASSETS.copy()
        merged = DEFAULT_ASSETS.copy()
        for pair, values in raw.items():
            if isinstance(values, dict):
                base = dict(merged.get(str(pair).upper(), {}))
                base.update(values)
                merged[str(pair).upper()] = base
        return merged
    except Exception:
        # Scoring must fail safe. Invalid external input falls back to
        # known placeholder data rather than crashing the public API.
        return DEFAULT_ASSETS.copy()


def build_scoreboard() -> dict[str, Any]:
    inputs = load_inputs()
    scores = [score_asset(pair, values) for pair, values in inputs.items()]
    scores.sort(key=lambda x: x.confidence, reverse=True)

    avg_conf = round(
        sum(s.confidence for s in scores) / len(scores), 1
    ) if scores else 0.0

    avg_trend = (
        sum(s.trend_score for s in scores) / len(scores)
        if scores else 50.0
    )
    avg_sentiment = (
        sum(s.sentiment_score for s in scores) / len(scores)
        if scores else 50.0
    )

    combined_regime = (avg_trend * 0.65) + (avg_sentiment * 0.35)
    if combined_regime >= 62:
        regime = "bullish"
    elif combined_regime <= 38:
        regime = "bearish"
    else:
        regime = "neutral"

    return {
        "ok": True,
        "version": "score-v1",
        "generated_at": time.time(),
        "weights": WEIGHTS,
        "market_regime": regime,
        "average_confidence": avg_conf,
        "assets": [asdict(s) for s in scores],
        "note": (
            "Score API v1 only. Sentiment is placeholder/manual until the "
            "daily news engine is connected. These scores do not place trades."
        ),
    }


def get_asset_score(symbol: str) -> dict[str, Any] | None:
    wanted = symbol.upper().replace("/", "-").replace(":", "-")
    board = build_scoreboard()
    for item in board["assets"]:
        pair = item["pair"].upper()
        normalized = pair.replace("/", "-").replace(":", "-")
        # Accept BTC, BTC-USDT, BTC/USDT and similar forms.
        if normalized == wanted or normalized.split("-")[0] == wanted:
            return item
    return None
