#!/usr/bin/env bash
# Call a specific tool on the asana-mcp-server
# Usage: ./scripts/call_tool.sh <tool_name> [json_arguments]
#
# Examples:
#   ./scripts/call_tool.sh health_check
#   ./scripts/call_tool.sh list_my_tasks '{"completed": false, "limit": 10}'
#   ./scripts/call_tool.sh get_task '{"task_gid": "1234567890"}'
#   ./scripts/call_tool.sh list_project_tasks '{"project_gid": "1234567890"}'

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <tool_name> [json_arguments]"
  echo ""
  echo "Examples:"
  echo "  $0 health_check"
  echo "  $0 list_my_tasks '{\"completed\": false, \"limit\": 10}'"
  echo "  $0 get_task '{\"task_gid\": \"1234567890\"}'"
  exit 1
fi

TOOL_NAME="$1"
TOOL_ARGS="${2:-{}}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

python3 "$SCRIPT_DIR/mcp_call.py" \
  --method tools/call \
  --tool "$TOOL_NAME" \
  --arguments "$TOOL_ARGS"
