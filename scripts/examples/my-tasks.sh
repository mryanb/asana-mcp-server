#!/usr/bin/env bash
# Example: List my incomplete tasks, sorted by due date
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
"$SCRIPT_DIR/call_tool.sh" list_my_tasks '{"completed": false, "sort_by": "due_date", "limit": 20}'
