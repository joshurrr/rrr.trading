#!/usr/bin/env bash
set -euo pipefail

cd /mnt/user/traderouter/public_api

docker build -t traderouter-public:latest .

# Persistent snapshots survive image rebuilds and container replacement.
mkdir -p /mnt/user/traderouter/data

docker rm -f traderouter-public 2>/dev/null || true

docker run -d \
  --name traderouter-public \
  --restart unless-stopped \
  --network host \
  -e FREQTRADE_URL=http://127.0.0.1:8080 \
  -e FREQTRADE_CONFIG=/config/config.json \
  -e CACHE_SECONDS=5 \
  -e DATA_DIR=/data \
  -e FRED_API_KEY \
  -v /mnt/user/traderouter/user_data/config.json:/config/config.json:ro \
  -v /mnt/user/traderouter/data:/data \
  traderouter-public:latest

echo
echo "Waiting for TradeRouter public API..."

for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8090/api/health >/dev/null 2>&1; then
    echo "API is ready."
    echo
    echo "Health:"
    curl -s http://127.0.0.1:8090/api/health
    echo
    echo
    echo "Demo:"
    curl -s http://127.0.0.1:8090/api/demo
    echo
    exit 0
  fi
  sleep 1
done

echo "API did not become ready within 20 seconds."
docker logs --tail 100 traderouter-public
exit 1
