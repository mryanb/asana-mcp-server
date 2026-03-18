import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolSchema extends Tool {
  /** If true, this tool only reads data and is available in readonly mode. */
  readonly: boolean;
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "health_check",
    readonly: true,
    description:
      "Check connectivity to Asana API. Returns authenticated user and workspace info.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_projects",
    readonly: true,
    description:
      "List projects in the workspace. Supports filtering by archived status, team, limit, and pagination via offset.",
    inputSchema: {
      type: "object" as const,
      properties: {
        archived: {
          type: "boolean",
          description: "Filter by archived status. Omit to include all.",
        },
        team: {
          type: "string",
          description: "Filter by team GID.",
        },
        limit: {
          type: "number",
          description: "Max number of results (default 50, max 200).",
        },
        offset: {
          type: "string",
          description: "Pagination offset from a previous response's next_page value.",
        },
      },
    },
  },
  {
    name: "get_project",
    readonly: true,
    description:
      "Get detailed info for a single project by GID. Includes members, status, and metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_gid: {
          type: "string",
          description: "The Asana project GID.",
        },
      },
      required: ["project_gid"],
    },
  },
  {
    name: "list_my_tasks",
    readonly: true,
    description:
      "List tasks assigned to the authenticated user. Supports filters for due dates, completion status, and project scope.",
    inputSchema: {
      type: "object" as const,
      properties: {
        completed: {
          type: "boolean",
          description: "Filter by completion status. Default false (incomplete only).",
        },
        due_on_before: {
          type: "string",
          description:
            "Only tasks due on or before this date (YYYY-MM-DD). Use for 'due soon' queries.",
        },
        due_on_after: {
          type: "string",
          description:
            "Only tasks due on or after this date (YYYY-MM-DD). Use for date range queries.",
        },
        project: {
          type: "string",
          description: "Filter to tasks in a specific project GID.",
        },
        sort_by: {
          type: "string",
          description:
            'Sort order: "due_date", "modified_at", "created_at", or "likes". Default "due_date".',
          enum: ["due_date", "modified_at", "created_at", "likes"],
        },
        limit: {
          type: "number",
          description: "Max number of results (default 50, max 200).",
        },
        offset: {
          type: "string",
          description: "Pagination offset from a previous response's next_page value.",
        },
      },
    },
  },
  {
    name: "search_tasks",
    readonly: true,
    description:
      "Search tasks in the workspace by text query and optional filters. Useful for finding specific tasks across projects.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Text to search for in task names and descriptions.",
        },
        assignee: {
          type: "string",
          description:
            'Assignee GID to filter by. Use "me" for the authenticated user.',
        },
        project: {
          type: "string",
          description: "Project GID to scope the search to.",
        },
        completed: {
          type: "boolean",
          description: "Filter by completion status.",
        },
        due_on_before: {
          type: "string",
          description: "Only tasks due on or before this date (YYYY-MM-DD).",
        },
        due_on_after: {
          type: "string",
          description: "Only tasks due on or after this date (YYYY-MM-DD).",
        },
        sort_by: {
          type: "string",
          description: 'Sort order. Default "modified_at".',
          enum: ["due_date", "modified_at", "created_at", "likes"],
        },
        limit: {
          type: "number",
          description: "Max number of results (default 50, max 200).",
        },
        offset: {
          type: "string",
          description: "Pagination offset from a previous response's next_page value.",
        },
      },
    },
  },
  {
    name: "get_task",
    readonly: true,
    description:
      "Get full details for a single task by GID. Returns all normalized task fields.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_gid: {
          type: "string",
          description: "The Asana task GID.",
        },
      },
      required: ["task_gid"],
    },
  },
  {
    name: "list_project_tasks",
    readonly: true,
    description:
      "List tasks in a project, optionally filtered to a specific section. Good for reading agendas and project boards.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_gid: {
          type: "string",
          description: "The Asana project GID.",
        },
        section_gid: {
          type: "string",
          description:
            "Optional section GID to filter tasks to a specific section/column.",
        },
        include_completed: {
          type: "boolean",
          description:
            "Include completed tasks. Default false (only incomplete tasks).",
        },
        limit: {
          type: "number",
          description: "Max number of results (default 50, max 200).",
        },
        offset: {
          type: "string",
          description: "Pagination offset from a previous response's next_page value.",
        },
      },
      required: ["project_gid"],
    },
  },
  {
    name: "list_task_stories",
    readonly: true,
    description:
      "List comments and activity on a task. Useful for understanding discussion history and recent updates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_gid: {
          type: "string",
          description: "The Asana task GID.",
        },
        limit: {
          type: "number",
          description: "Max number of stories to return (default 25, max 100).",
        },
      },
      required: ["task_gid"],
    },
  },
  {
    name: "list_sections",
    readonly: true,
    description:
      "List sections in a project. Useful for understanding project structure, board columns, or agenda categories.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_gid: {
          type: "string",
          description: "The Asana project GID.",
        },
      },
      required: ["project_gid"],
    },
  },

  {
    name: "get_project_brief",
    readonly: true,
    description:
      "Get the Overview/brief content for a project. Returns the rich text from the project's Overview tab including goals, links, and status summaries. Returns null if no brief exists.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_gid: {
          type: "string",
          description: "The Asana project GID.",
        },
      },
      required: ["project_gid"],
    },
  },
  {
    name: "get_notifications",
    readonly: true,
    description:
      "Get recent activity relevant to the authenticated user. Returns tasks that were recently modified where the user is the assignee. Useful for surfacing mentions, assignment changes, and inbox-like activity without opening Asana.",
    inputSchema: {
      type: "object" as const,
      properties: {
        since: {
          type: "string",
          description:
            "ISO 8601 datetime or YYYY-MM-DD date. Only tasks modified after this time are returned. Default: 24 hours ago.",
        },
        limit: {
          type: "number",
          description: "Max number of results (default 25, max 100).",
        },
      },
    },
  },
  {
    name: "list_tags",
    readonly: true,
    description:
      "List tags in the workspace. Useful for understanding categorization and filtering options.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max number of results (default 50, max 200).",
        },
      },
    },
  },

  // --- Write tools (require readonly_mode=false) ---

  {
    name: "create_task",
    readonly: false,
    description:
      "Create a new task in a project. Requires write access. The project must be in the write_allowlist if configured.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The task name/title.",
        },
        project_gid: {
          type: "string",
          description: "The project GID to create the task in.",
        },
        notes: {
          type: "string",
          description: "Task description (plain text).",
        },
        assignee: {
          type: "string",
          description:
            'Assignee GID. Use "me" to assign to the authenticated user.',
        },
        due_on: {
          type: "string",
          description: "Due date in YYYY-MM-DD format.",
        },
        section_gid: {
          type: "string",
          description:
            "Optional section GID to place the task in a specific section/column.",
        },
      },
      required: ["name", "project_gid"],
    },
  },
  {
    name: "update_task",
    readonly: false,
    description:
      "Update fields on an existing task. Supports changing name, notes, assignee, due date, and completion status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_gid: {
          type: "string",
          description: "The Asana task GID to update.",
        },
        name: {
          type: "string",
          description: "New task name.",
        },
        notes: {
          type: "string",
          description: "New task description (plain text).",
        },
        assignee: {
          type: "string",
          description:
            'New assignee GID. Use "me" for the authenticated user.',
        },
        due_on: {
          type: "string",
          description: "New due date in YYYY-MM-DD format.",
        },
        completed: {
          type: "boolean",
          description: "Mark the task as completed (true) or incomplete (false).",
        },
      },
      required: ["task_gid"],
    },
  },
  {
    name: "comment_on_task",
    readonly: false,
    description:
      "Add a comment to a task. The comment is posted as the authenticated user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_gid: {
          type: "string",
          description: "The Asana task GID to comment on.",
        },
        text: {
          type: "string",
          description: "The comment text (plain text).",
        },
      },
      required: ["task_gid", "text"],
    },
  },
  {
    name: "complete_task",
    readonly: false,
    description:
      "Mark a task as completed. Convenience shortcut — equivalent to update_task with completed=true. Scoped to write_allowlist if configured.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_gid: {
          type: "string",
          description: "The Asana task GID to complete.",
        },
      },
      required: ["task_gid"],
    },
  },
  {
    name: "delete_task",
    readonly: false,
    description:
      "Permanently delete a task. Destructive and irreversible. Requires ASANA_MCP_ALLOW_DELETE=true (separate from general write access). Scoped to write_allowlist if configured.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_gid: {
          type: "string",
          description: "The Asana task GID to delete.",
        },
      },
      required: ["task_gid"],
    },
  },
];
