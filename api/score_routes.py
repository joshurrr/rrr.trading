from fastapi import APIRouter
from fastapi.responses import JSONResponse

from scoring import build_scoreboard, get_asset_score

router = APIRouter(tags=["TradeRRR Score API"])


@router.get("/score")
@router.get("/api/score")
def score_all():
    return build_scoreboard()


@router.get("/score/{symbol}")
@router.get("/api/score/{symbol}")
def score_one(symbol: str):
    result = get_asset_score(symbol)
    if result is None:
        return JSONResponse(
            status_code=404,
            content={
                "ok": False,
                "error": f"No score configured for {symbol}",
            },
        )
    return {"ok": True, **result}


@router.get("/market-regime")
def market_regime():
    board = build_scoreboard()
    return {
        "ok": True,
        "generated_at": board["generated_at"],
        "market_regime": board["market_regime"],
        "average_confidence": board["average_confidence"],
    }
