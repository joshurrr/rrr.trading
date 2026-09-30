#!/usr/bin/env python3
"""
Patch current traderouter-public main.py into a JSON-only API surface.

Result:
  /               service status JSON
  /status         trading status JSON
  /health         health JSON
  /score          scoring JSON
  /score/{symbol} scoring JSON
  /market-regime  regime JSON

Removes the API-hosted HTML /demo route.
Creates a timestamped backup first.
"""
from pathlib import Path
import re
import shutil
import sys
import time

if len(sys.argv) != 2:
    raise SystemExit("Usage: python3 install_api_clean_split.py /path/to/main.py")

path = Path(sys.argv[1]).resolve()
if not path.exists():
    raise SystemExit(f"File not found: {path}")

text = path.read_text(encoding="utf-8")
backup = path.with_name(f"{path.name}.before-api-split-{int(time.time())}")
shutil.copy2(path, backup)

# Add score router import.
import_line = "from score_routes import router as score_router"
if import_line not in text:
    lines = text.splitlines()
    insert_at = None
    for i, line in enumerate(lines):
        if line.startswith("from fastapi.responses import"):
            insert_at = i + 1
            break
    if insert_at is None:
        raise SystemExit("Could not locate FastAPI response import")
    lines.insert(insert_at, import_line)
    text = "\n".join(lines) + "\n"

# Include router before middleware.
include_line = "app.include_router(score_router)"
if include_line not in text:
    marker = "app.add_middleware("
    pos = text.find(marker)
    if pos == -1:
        raise SystemExit("Could not locate middleware setup")
    text = text[:pos] + include_line + "\n\n" + text[pos:]

# Clean JSON endpoint names.
text = text.replace('@app.get("/api/demo")', '@app.get("/status")')
text = text.replace('@app.get("/api/health")', '@app.get("/health")')

# Remove embedded dashboard HTML block.
text = re.sub(
    r'\nDASHBOARD_HTML\s*=\s*r?""".*?"""\s*\n',
    '\n',
    text,
    flags=re.S
)

# Remove /demo FastAPI HTML handler if still present.
text = re.sub(
    r'\n@app\.get\("/demo",\s*response_class=HTMLResponse\)\s*\ndef\s+demo_dashboard\(\):\s*\n\s*return\s+HTMLResponse\(DASHBOARD_HTML\)\s*\n',
    '\n',
    text,
    flags=re.S
)

# Remove unused HTMLResponse import without disturbing JSONResponse.
text = text.replace(
    "from fastapi.responses import HTMLResponse, JSONResponse",
    "from fastapi.responses import JSONResponse"
)

path.write_text(text, encoding="utf-8")
print(f"Patched: {path}")
print(f"Backup:  {backup}")
print("API is now JSON-only.")
