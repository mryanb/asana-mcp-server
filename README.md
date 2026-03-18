# asana-mcp-server

A [Model Context Protocol](https://modelcontextprotocol.io) server for Asana. Gives AI agents structured access to projects, tasks, comments, and workspace data — read-only by default with optional, scoped write access.

## Features

- 17 tools covering projects, tasks, sections, stories, tags, notifications, and write operations
- Read-only by default with layered write controls (readonly mode, project allowlist, delete gate)
- Stable JSON output with GIDs and permalinks
- Configurable limits and pagination to control token usage
- Auto-detects workspace from authenticated user
- Project allowlist support for scoping both reads and writes
- `.env` file support — no secrets in your Claude Desktop config

## Requirements

- Node.js 18+
- Asana personal access token (or service account token)

## Quick Start

```bash
git clone https://github.com/mryanb/asana-mcp-server.git
cd asana-mcp-server
npm install
npm run build
```

Copy `.env.example` to `.env` and add your Asana access token:

```bash
cp .env.example .env
# Edit .env and set ASANA_ACCESS_TOKEN
```

Run the server:

```bash
node dist/index.js
```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "asana": {
      "command": "node",
      "args": ["/path/to/asana-mcp-server/dist/index.js"]
    }
  }
}
```

The server loads credentials from the `.env` file in the project root, so you don't need to put secrets in this config. If you prefer env vars directly:

```json
{
  "mcpServers": {
    "asana": {
      "command": "node",
      "args": ["/path/to/asana-mcp-server/dist/index.js"],
      "env": {
        "ASANA_ACCESS_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Tools

### Read Tools

| Tool | Description |
|------|-------------|
| `health_check` | Verify API connectivity and auth |
| `list_projects` | List workspace projects (filter by archived/team) |
| `get_project` | Get full project details including members and status |
| `get_project_brief` | Get the Overview/brief tab content for a project |
| `list_my_tasks` | Tasks assigned to me (due soon, overdue, by project) |
| `search_tasks` | Full-text search with filters |
| `get_task` | Complete task details |
| `list_project_tasks` | Tasks in a project, optionally by section |
| `list_task_stories` | Comments and activity on a task |
| `list_sections` | Sections/columns in a project |
| `list_tags` | Tags in the workspace |
| `get_notifications` | Recent activity for the authenticated user |

### Write Tools

Write tools require `ASANA_MCP_READONLY=false`.

| Tool | Description |
|------|-------------|
| `create_task` | Create a task in a project |
| `update_task` | Update task fields — name, assignee, due date, completion |
| `comment_on_task` | Add a comment to a task |
| `complete_task` | Mark a task as completed |
| `delete_task` | Permanently delete a task (requires `ASANA_MCP_ALLOW_DELETE=true`) |

All list tools support pagination via `offset` parameter and return `next_page` for subsequent requests. See [docs/tools.md](docs/tools.md) for full parameter details.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ASANA_ACCESS_TOKEN` | **Required.** Asana API token | — |
| `ASANA_WORKSPACE_GID` | Workspace GID (auto-detected if omitted) | — |
| `ASANA_MCP_DEFAULT_LIMIT` | Default result limit | `50` |
| `ASANA_MCP_MAX_LIMIT` | Maximum result limit | `200` |
| `ASANA_MCP_READONLY` | Readonly mode — hides and blocks write tools | `true` |
| `ASANA_MCP_PROJECT_ALLOWLIST` | Restrict reads to these project GIDs (comma-separated) | — |
| `ASANA_MCP_WRITE_ALLOWLIST` | Restrict writes to these project GIDs (comma-separated). Use `*` for all. | — |
| `ASANA_MCP_ALLOW_WRITE_MY_TASKS` | Allow writes on tasks assigned to the authenticated user regardless of project | `false` |
| `ASANA_MCP_ALLOW_DELETE` | Enable `delete_task` tool (separate from write access) | `false` |
| `ASANA_MCP_LOG_LEVEL` | Log verbosity: `debug`, `info`, `warning`, `error` | `info` |

### Config File

Optional: `~/.config/asana-mcp/config.json`

```json
{
  "workspace_gid": "YOUR_WORKSPACE_GID",
  "default_limit": 50,
  "max_limit": 200,
  "readonly_mode": true,
  "log_level": "info",
  "project_allowlist": ["PROJECT_GID_1", "PROJECT_GID_2"],
  "write_allowlist": ["PROJECT_GID_1"]
}
```

Environment variables override config file values.

### Security Model

The server enforces a three-layer security model:

1. **Readonly mode** (default: on) — write tools are hidden from `tools/list` and blocked at execution
2. **Write allowlist** — when set, writes are only allowed to specific projects. The `allow_write_my_tasks` bypass permits writes on tasks assigned to the authenticated user regardless of project.
3. **Delete gate** — `delete_task` requires its own independent opt-in (`ASANA_MCP_ALLOW_DELETE=true`)

## Testing

```bash
npm test
```

## License

MIT
