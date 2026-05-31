#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"

# Start server in a new Terminal window
osascript -e "tell app \"Terminal\" to do script \"cd '$DIR/server' && npm run dev\""

# Start client in a new Terminal window
osascript -e "tell app \"Terminal\" to do script \"cd '$DIR/client' && npm run dev\""

# Wait for Vite to be ready then open Chrome
echo "Waiting for servers to start..."
sleep 6
open -a "Google Chrome" http://localhost:5173
