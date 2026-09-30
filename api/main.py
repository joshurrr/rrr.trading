
import json
import os
import time
import secrets
import logging
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from score_routes import router as score_router
from macro_routes import install_macro_reports

CONFIG_PATH = Path(os.getenv("FREQTRADE_CONFIG", "/config/config.json"))
logging.basicConfig(level=logging.INFO)
FREQTRADE_URL = os.getenv("FREQTRADE_URL", "http://127.0.0.1:8080").rstrip("/")
CACHE_SECONDS = int(os.getenv("CACHE_SECONDS", "5"))

app = FastAPI(
    title="TradeRouter Public Demo API",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.include_router(score_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rrr.trading",
        "https://www.rrr.trading",
        "http://localhost",
        "http://127.0.0.1",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_cache: dict[str, Any] = {"ts": 0.0, "payload": None}
_token: dict[str, Any] = {"value": None, "ts": 0.0}


def load_credentials():
    data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    api = data.get("api_server") or {}
    return (
        str(api.get("username") or ""),
        str(api.get("password") or ""),
    )


admin_basic = HTTPBasic(auto_error=False)


def require_macro_admin(credentials: HTTPBasicCredentials = Depends(admin_basic)):
    """Reuse the mounted Freqtrade API credentials; no separate account/token store."""
    try:
        username, password = load_credentials()
    except (OSError, ValueError):
        raise HTTPException(503, "Admin authentication unavailable")
    if not username or not password:
        raise HTTPException(503, "Admin authentication unavailable")
    supplied_user = credentials.username if credentials else ""
    supplied_password = credentials.password if credentials else ""
    user_ok = secrets.compare_digest(supplied_user.encode(), username.encode())
    password_ok = secrets.compare_digest(supplied_password.encode(), password.encode())
    if not (user_ok and password_ok):
        raise HTTPException(401, "Admin authentication required", headers={"WWW-Authenticate": "Basic"})


macro_reports = install_macro_reports(app, admin_dependency=require_macro_admin)


def get_token(force=False):
    now = time.time()
    if not force and _token["value"] and now - _token["ts"] < 12 * 60:
        return _token["value"]

    username, password = load_credentials()
    response = requests.post(
        f"{FREQTRADE_URL}/api/v1/token/login",
        auth=(username, password),
        timeout=5,
    )
    response.raise_for_status()
    token = response.json()["access_token"]
    _token.update(value=token, ts=now)
    return token


def ft_get(path: str, params=None):
    def make_request(token):
        return requests.get(
            f"{FREQTRADE_URL}/api/v1/{path.lstrip('/')}",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=6,
        )

    response = make_request(get_token())
    if response.status_code == 401:
        response = make_request(get_token(force=True))
    response.raise_for_status()
    return response.json()


def num(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def clean_open_trade(t):
    return {
        "id": t.get("trade_id") or t.get("id"),
        "pair": t.get("pair"),
        "direction": "SHORT" if t.get("is_short") else "LONG",
        "entry_tag": t.get("enter_tag") or t.get("buy_tag"),
        "open_rate": t.get("open_rate"),
        "current_rate": t.get("current_rate"),
        "stake_amount": t.get("stake_amount"),
        "amount": t.get("amount"),
        "profit_pct": num(t.get("profit_pct", t.get("profit_ratio"))) * (
            1 if t.get("profit_pct") is not None else 100
        ),
        "profit_abs": t.get("profit_abs"),
        "open_date": t.get("open_date") or t.get("open_date_utc"),
        "stop_loss": t.get("stop_loss"),
        "leverage": t.get("leverage", 1.0),
    }


def clean_trade(t):
    return {
        "id": t.get("trade_id") or t.get("id"),
        "pair": t.get("pair"),
        "direction": "SHORT" if t.get("is_short") else "LONG",
        "entry_tag": t.get("enter_tag") or t.get("buy_tag"),
        "exit_reason": t.get("exit_reason") or t.get("sell_reason"),
        "open_rate": t.get("open_rate"),
        "close_rate": t.get("close_rate"),
        "stake_amount": t.get("stake_amount"),
        "profit_pct": num(t.get("profit_pct", t.get("profit_ratio"))) * (
            1 if t.get("profit_pct") is not None else 100
        ),
        "profit_abs": t.get("profit_abs") or t.get("close_profit_abs"),
        "open_date": t.get("open_date") or t.get("open_date_utc"),
        "close_date": t.get("close_date") or t.get("close_date_utc"),
    }


def build_payload():
    ping = requests.get(f"{FREQTRADE_URL}/api/v1/ping", timeout=3).json()
    status = ft_get("status")
    trades_data = ft_get("trades", {"limit": 50, "offset": 0, "order_by_id": False})
    profit = ft_get("profit")
    count = ft_get("count")
    config = ft_get("show_config")
    version = ft_get("version")
    health = ft_get("health")

    raw_trades = trades_data.get("trades", trades_data if isinstance(trades_data, list) else [])
    closed = [clean_trade(t) for t in raw_trades if not t.get("is_open")]
    open_trades = [clean_open_trade(t) for t in status]

    starting_balance = 10000.0
    dry_run_wallet = config.get("dry_run_wallet")
    if dry_run_wallet is not None:
        starting_balance = num(dry_run_wallet, 10000.0)

    total_profit = (
        profit.get("profit_all_coin")
        or profit.get("profit_closed_coin")
        or profit.get("profit_all_fiat")
        or 0.0
    )

    return {
        "ok": ping.get("status") == "pong",
        "generated_at": time.time(),
        "bot": {
            "name": config.get("bot_name", "traderouter"),
            "state": "RUNNING" if ping.get("status") == "pong" else "OFFLINE",
            "mode": "PAPER" if config.get("dry_run", True) else "LIVE",
            "exchange": config.get("exchange", {}).get("name") if isinstance(config.get("exchange"), dict) else config.get("exchange"),
            "strategy": config.get("strategy", "RRRTrendV1"),
            "timeframe": config.get("timeframe"),
            "stake_currency": config.get("stake_currency"),
            "stake_amount": config.get("stake_amount"),
            "max_open_trades": config.get("max_open_trades"),
            "version": version.get("version") if isinstance(version, dict) else version,
        },
        "portfolio": {
            "starting_balance": starting_balance,
            "open_positions": len(open_trades),
            "max_open_positions": count.get("max") or config.get("max_open_trades"),
            "closed_trades": len(closed),
            "total_trades": profit.get("trade_count") or len(raw_trades),
            "winning_trades": profit.get("winning_trades"),
            "losing_trades": profit.get("losing_trades"),
            "profit_closed_pct": profit.get("profit_closed_percent"),
            "profit_all_pct": profit.get("profit_all_percent"),
            "profit_all_abs": total_profit,
        },
        "open_trades": open_trades,
        "history": closed[:25],
    }


@app.get("/")
def root():
    return {"service": "traderouter-public", "status": "ok"}


@app.get("/api/demo")
@app.get("/api/status")
@app.get("/status")
def demo():
    now = time.time()
    if _cache["payload"] is not None and now - _cache["ts"] < CACHE_SECONDS:
        return _cache["payload"]

    try:
        payload = build_payload()
        _cache.update(ts=now, payload=payload)
        return payload
    except Exception as exc:
        # Never expose credentials, tokens, config contents or stack traces publicly.
        return JSONResponse(
            status_code=503,
            content={
                "ok": False,
                "generated_at": now,
                "error": "TradeRouter data temporarily unavailable",
            },
        )


@app.get("/api/health")
@app.get("/health")
def health():
    try:
        ping = requests.get(f"{FREQTRADE_URL}/api/v1/ping", timeout=3).json()
        return {"ok": ping.get("status") == "pong"}
    except Exception:
        return JSONResponse(status_code=503, content={"ok": False})
