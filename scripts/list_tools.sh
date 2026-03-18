#!/usr/bin/env bash
# List available tools from the asana-mcp-server
# Usage: ./scripts/list_tools.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

python3 "$SCRIPT_DIR/mcp_call.py" --method tools/list
