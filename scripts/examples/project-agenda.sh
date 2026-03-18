#!/usr/bin/env bash
# Example: List tasks in a project (e.g. meeting agenda)
# Replace the project_gid with your actual project GID
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

PROJECT_GID="${1:-1207671807026036}"
"$SCRIPT_DIR/call_tool.sh" list_project_tasks "{\"project_gid\": \"$PROJECT_GID\"}"
