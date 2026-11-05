#!/usr/bin/env bash
# MedScan AI — one-command launcher.
# Starts the backend (port 5000) and the frontend static server (port 5173).
# Requires only Node.js 18+ — no npm install needed.

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🩺 Starting MedScan AI..."
echo

# Start backend
node "$ROOT/server/index.js" &
BACKEND_PID=$!

# Start frontend static server
node "$ROOT/client/serve.js" 5173 &
FRONTEND_PID=$!

echo
echo "➡️  Open http://localhost:5173 in your browser"
echo "   (Backend API at http://localhost:5000)"
echo "   Press Ctrl+C to stop both."
echo

# Clean up both processes on exit
trap "echo; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
