#!/usr/bin/env bash
# Example: Get recent comments on a task
# Usage: ./scripts/examples/task-comments.sh <task_gid>
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

TASK_GID="${1:?Usage: $0 <task_gid>}"
"$SCRIPT_DIR/call_tool.sh" list_task_stories "{\"task_gid\": \"$TASK_GID\", \"limit\": 10}"
