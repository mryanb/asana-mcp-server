#!/usr/bin/env bash
# Configure asana-mcp-server
# Creates config directory and initial config file

set -euo pipefail

CONFIG_DIR="$HOME/.config/asana-mcp"
CONFIG_FILE="$CONFIG_DIR/config.json"

echo "=== asana-mcp-server configuration ==="
echo ""

mkdir -p "$CONFIG_DIR"

if [ -f "$CONFIG_FILE" ]; then
  echo "Config file already exists at $CONFIG_FILE"
  echo "Current contents:"
  cat "$CONFIG_FILE"
  echo ""
  read -r -p "Overwrite? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[yY]$ ]]; then
    echo "Keeping existing config."
    exit 0
  fi
fi

# Workspace GID
echo ""
echo "Enter your Asana workspace GID (find it in Asana URL or leave blank to auto-detect):"
read -r workspace_gid

# Default limit
echo ""
echo "Default result limit (default: 50):"
read -r default_limit
default_limit="${default_limit:-50}"

# Max limit
echo ""
echo "Maximum result limit (default: 200):"
read -r max_limit
max_limit="${max_limit:-200}"

# Log level
echo ""
echo "Log level (debug/info/warning/error, default: info):"
read -r log_level
log_level="${log_level:-info}"

# Project whitelist
echo ""
echo "Project whitelist GIDs (comma-separated, or leave blank for all):"
read -r whitelist_raw

# Build JSON
whitelist_json="null"
if [ -n "$whitelist_raw" ]; then
  whitelist_json="[$(echo "$whitelist_raw" | sed 's/[[:space:]]//g' | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/' )]"
fi

workspace_json="null"
if [ -n "$workspace_gid" ]; then
  workspace_json="\"$workspace_gid\""
fi

cat > "$CONFIG_FILE" << EOF
{
  "workspace_gid": $workspace_json,
  "default_limit": $default_limit,
  "max_limit": $max_limit,
  "log_level": "$log_level",
  "project_whitelist": $whitelist_json
}
EOF

echo ""
echo "Config written to $CONFIG_FILE"
echo ""
echo "Next steps:"
echo "  1. Store your Asana access token in 1Password"
echo "  2. Run the server with:"
echo '     ASANA_ACCESS_TOKEN="your-token" npx asana-mcp-server'
echo ""
echo "  Or with 1Password injection:"
echo '     OP_SERVICE_ACCOUNT_TOKEN="$(security find-generic-password -s openclaw-op-service-token -w)" \'
echo '     ASANA_ACCESS_TOKEN="op://Bots/REPLACE_ME/access_token" \'
echo '     op run -- npx asana-mcp-server'
