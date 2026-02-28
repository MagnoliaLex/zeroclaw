#!/usr/bin/env bash
# Start the ZeroClaw App Factory pipeline
# Usage: ./scripts/start-app-factory.sh [dashboard|api|route|all]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Ensure state directories exist
mkdir -p "$ROOT_DIR/app-factory/state"
mkdir -p "$ROOT_DIR/app-factory/projects"
mkdir -p "$ROOT_DIR/app-factory/logs"

case "${1:-all}" in
  api)
    echo "Starting Dashboard API on localhost:3002..."
    cd "$ROOT_DIR/dashboard-api"
    [ -d node_modules ] || npm install
    exec node server.js
    ;;
  dashboard)
    echo "Starting Dashboard UI on localhost:3001..."
    cd "$ROOT_DIR/dashboard"
    [ -d node_modules ] || npm install
    exec npm run dev
    ;;
  route)
    echo "Running Shelly router once..."
    exec node "$ROOT_DIR/skills/app-factory/shelly-router/tools/route.js"
    ;;
  test)
    echo "Running App Factory tests..."
    exec node "$ROOT_DIR/app-factory/tests/run.js"
    ;;
  all)
    echo "=== ZeroClaw App Factory ==="
    echo ""
    echo "Starting Dashboard API (port 3002) and Dashboard UI (port 3001)..."
    echo ""

    # Start API in background
    cd "$ROOT_DIR/dashboard-api"
    [ -d node_modules ] || npm install
    node server.js &
    API_PID=$!

    # Start Dashboard in background
    cd "$ROOT_DIR/dashboard"
    [ -d node_modules ] || npm install
    npm run dev &
    UI_PID=$!

    echo ""
    echo "Dashboard API: http://localhost:3002"
    echo "Dashboard UI:  http://localhost:3001"
    echo ""
    echo "To add heartbeat (auto-routing every 5 min):"
    echo "  Add to HEARTBEAT.md: - Run App Factory router: node skills/app-factory/shelly-router/tools/route.js"
    echo "  Then start: zeroclaw daemon"
    echo ""
    echo "Press Ctrl+C to stop."

    trap "kill $API_PID $UI_PID 2>/dev/null; exit" INT TERM
    wait
    ;;
  *)
    echo "Usage: $0 [api|dashboard|route|test|all]"
    exit 1
    ;;
esac
