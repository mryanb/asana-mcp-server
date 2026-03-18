#!/usr/bin/env python3
"""
Minimal MCP client for testing asana-mcp-server over stdio.

Usage:
  python3 mcp_call.py --method tools/list
  python3 mcp_call.py --method tools/call --tool health_check
  python3 mcp_call.py --method tools/call --tool list_my_tasks --arguments '{"limit": 5}'

Environment:
  ASANA_ACCESS_TOKEN  - Required. Asana personal access token.
  ASANA_MCP_SERVER    - Path to server binary/script. Default: node dist/index.js

The script launches the MCP server as a subprocess, sends JSON-RPC messages
over stdin/stdout, and prints the response.
"""

import argparse
import json
import os
import subprocess
import sys


def send_jsonrpc(proc, method: str, params: dict | None = None, msg_id: int = 1) -> dict:
    """Send a JSON-RPC request and read the response."""
    request = {
        "jsonrpc": "2.0",
        "id": msg_id,
        "method": method,
    }
    if params is not None:
        request["params"] = params

    payload = json.dumps(request) + "\n"
    proc.stdin.write(payload)
    proc.stdin.flush()

    line = proc.stdout.readline()
    if not line:
        raise RuntimeError("Server closed connection without response")

    return json.loads(line)


def main():
    parser = argparse.ArgumentParser(description="MCP client for asana-mcp-server")
    parser.add_argument("--method", required=True, help="MCP method (e.g., tools/list, tools/call)")
    parser.add_argument("--tool", help="Tool name (for tools/call)")
    parser.add_argument("--arguments", default="{}", help="JSON arguments for the tool")
    parser.add_argument("--server", help="Server command override")
    args = parser.parse_args()

    # Determine server command
    server_cmd = args.server or os.environ.get("ASANA_MCP_SERVER")
    if not server_cmd:
        # Default: run from project root
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        server_cmd = f"node {project_root}/dist/index.js"

    # Inherit environment (ASANA_ACCESS_TOKEN, etc.)
    env = os.environ.copy()

    proc = subprocess.Popen(
        server_cmd.split(),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )

    try:
        # Step 1: Initialize
        init_resp = send_jsonrpc(proc, "initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "mcp_call.py", "version": "0.1.0"},
        }, msg_id=1)

        if "error" in init_resp:
            print(json.dumps(init_resp["error"], indent=2), file=sys.stderr)
            sys.exit(1)

        # Step 2: Send initialized notification
        notification = {"jsonrpc": "2.0", "method": "notifications/initialized"}
        proc.stdin.write(json.dumps(notification) + "\n")
        proc.stdin.flush()

        # Step 3: Call the requested method
        if args.method == "tools/list":
            resp = send_jsonrpc(proc, "tools/list", {}, msg_id=2)
        elif args.method == "tools/call":
            if not args.tool:
                print("Error: --tool is required for tools/call", file=sys.stderr)
                sys.exit(1)
            tool_args = json.loads(args.arguments)
            resp = send_jsonrpc(proc, "tools/call", {
                "name": args.tool,
                "arguments": tool_args,
            }, msg_id=2)
        else:
            resp = send_jsonrpc(proc, args.method, {}, msg_id=2)

        # Pretty-print result
        if "result" in resp:
            print(json.dumps(resp["result"], indent=2))
        elif "error" in resp:
            print(json.dumps(resp["error"], indent=2), file=sys.stderr)
            sys.exit(1)
        else:
            print(json.dumps(resp, indent=2))

    finally:
        proc.terminate()
        proc.wait(timeout=5)


if __name__ == "__main__":
    main()
