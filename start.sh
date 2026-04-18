#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo " NEXUS — Starting local HTTPS server..."
echo ""

# Check for Node.js
if ! command -v node &>/dev/null; then
  echo " ERROR: Node.js not found."
  echo " Install via: https://nodejs.org/ or  brew install node"
  exit 1
fi

node "$SCRIPT_DIR/serve.js"
