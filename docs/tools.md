# Tools Reference

## Pagination

All list tools support an `offset` parameter for pagination. When more results are available, the response includes a `next_page` value — pass it as `offset` in the next call.

```json
{ "count": 50, "next_page": "eyJ...", "items": [...] }
```

---

## health_check

Check connectivity to Asana API.

**Parameters:** none

**Response:**
```json
{
  "status": "ok",
  "user": "Your Name",
  "workspace": "Your Workspace",
  "version": "0.1.2",
  "tools_available": 12
}
```

---

## list_projects

List projects in the workspace.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `archived` | boolean | Filter by archived status. Omit for all. |
| `team` | string | Filter by team GID. |
| `limit` | number | Max results (default 50, max 200). |
| `offset` | string | Pagination offset from a previous response. |

---

## get_project

Get detailed info for a single project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_gid` | string | yes | Asana project GID |

**Returns:** Full project object with members, status, owner, team, and permalink.

---

## get_project_brief

Get the Overview/brief content for a project. Returns the rich text from the project's Overview tab.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_gid` | string | yes | Asana project GID |

**Returns:** Brief object with `title`, `text`, `html_text`, and `permalink_url`. Returns null if no brief exists.

---

## list_my_tasks

List tasks assigned to the authenticated user.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `completed` | boolean | Filter by completion (default false). |
| `due_on_before` | string | Tasks due on or before date (YYYY-MM-DD). |
| `due_on_after` | string | Tasks due on or after date (YYYY-MM-DD). |
| `project` | string | Scope to a specific project GID. |
| `sort_by` | string | `due_date`, `modified_at`, `created_at`, `likes` (default `due_date`). |
| `limit` | number | Max results (default 50, max 200). |
| `offset` | string | Pagination offset from a previous response. |

**Examples:**

Due in the next 7 days:
```json
{ "due_on_before": "2026-03-23", "due_on_after": "2026-03-16" }
```

Overdue tasks:
```json
{ "due_on_before": "2026-03-15" }
```

---

## search_tasks

Search tasks across the workspace.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `query` | string | Text search in names and descriptions. |
| `assignee` | string | User GID or `"me"`. |
| `project` | string | Scope to project GID. |
| `completed` | boolean | Filter by completion status. |
| `due_on_before` | string | Tasks due on or before date (YYYY-MM-DD). |
| `due_on_after` | string | Tasks due on or after date (YYYY-MM-DD). |
| `sort_by` | string | Sort field (default `modified_at`). |
| `limit` | number | Max results (default 50, max 200). |
| `offset` | string | Pagination offset from a previous response. |

---

## get_task

Get full details for a single task.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task_gid` | string | yes | Asana task GID |

**Returns:** Complete task object with assignee, dates, projects, sections, tags, notes, and permalink.

---

## list_project_tasks

List tasks in a project, optionally filtered to a section.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_gid` | string | yes | Asana project GID |
| `section_gid` | string | no | Filter to a specific section |
| `include_completed` | boolean | no | Include completed tasks (default false) |
| `limit` | number | no | Max results (default 50, max 200) |
| `offset` | string | no | Pagination offset from a previous response |

---

## list_task_stories

List comments and activity on a task.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task_gid` | string | yes | Asana task GID |
| `limit` | number | no | Max stories (default 25, max 100) |

**Returns:** Array of story objects with `created_at`, `created_by`, `type`, `text`, and `resource_subtype`.

---

## list_sections

List sections in a project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_gid` | string | yes | Asana project GID |

**Returns:** Array of section objects with `gid`, `name`, and `created_at`.

---

## list_tags

List tags in the workspace.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `limit` | number | Max results (default 50, max 200). |

---

## get_notifications

Get recent activity for the authenticated user. Returns tasks that were recently modified where the user is the assignee.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `since` | string | ISO 8601 datetime or YYYY-MM-DD. Only tasks modified after this time. Default: 24 hours ago. |
| `limit` | number | Max results (default 25, max 100). |

---

## create_task

Create a new task in a project. Requires write access.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Task name/title |
| `project_gid` | string | yes | Project GID to create the task in |
| `notes` | string | no | Task description (plain text) |
| `assignee` | string | no | Assignee GID or `"me"` |
| `due_on` | string | no | Due date (YYYY-MM-DD) |
| `section_gid` | string | no | Section GID to place the task in |

---

## update_task

Update fields on an existing task. Requires write access.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task_gid` | string | yes | Asana task GID |
| `name` | string | no | New task name |
| `notes` | string | no | New description |
| `assignee` | string | no | New assignee GID or `"me"` |
| `due_on` | string | no | New due date (YYYY-MM-DD) |
| `completed` | boolean | no | Mark completed or incomplete |

---

## comment_on_task

Add a comment to a task. Requires write access.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task_gid` | string | yes | Asana task GID |
| `text` | string | yes | Comment text (plain text) |

---

## complete_task

Mark a task as completed. Convenience shortcut for `update_task` with `completed=true`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task_gid` | string | yes | Asana task GID |

---

## delete_task

Permanently delete a task. Requires `ASANA_MCP_ALLOW_DELETE=true` in addition to write access.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task_gid` | string | yes | Asana task GID |
