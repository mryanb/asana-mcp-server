import type { AsanaClient } from "../asana-client.js";
import type { ServerConfig } from "../models/types.js";
import { log, logToolCall } from "../config/configuration.js";
import { TOOL_SCHEMAS } from "./schemas.js";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function clampLimit(
  requested: number | undefined,
  config: ServerConfig
): number {
  const val = requested ?? config.default_limit;
  return Math.max(1, Math.min(val, config.max_limit));
}

export class ToolRouter {
  private client: AsanaClient;
  private config: ServerConfig;
  private myUserGid: string | null = null;

  constructor(client: AsanaClient, config: ServerConfig) {
    this.client = client;
    this.config = config;
  }

  private async getMyGid(): Promise<string> {
    if (!this.myUserGid) {
      this.myUserGid = await this.client.getMyUserGid();
    }
    return this.myUserGid;
  }

  /**
   * Check if a read operation is allowed for the given project GID.
   * Returns an error ToolResult if blocked by project_allowlist, or undefined if allowed.
   */
  checkProjectAllowed(projectGid: string): ToolResult | undefined {
    const allowlist = this.config.project_allowlist;
    if (!allowlist || allowlist.length === 0) return undefined;
    if (allowlist.includes(projectGid)) return undefined;
    log(
      "warning",
      `Blocked read on project ${projectGid} — not in project_allowlist`,
    );
    return err(
      `Project ${projectGid} is not in the project_allowlist. ` +
      `Allowed projects: ${allowlist.join(", ")}`
    );
  }

  /**
   * Check if a write operation is allowed for the given project GID.
   * Returns an error ToolResult if blocked, or undefined if allowed.
   */
  checkWriteAllowed(projectGid: string | undefined): ToolResult | undefined {
    if (this.config.readonly_mode) {
      return err(
        "Server is in readonly mode. Set ASANA_MCP_READONLY=false to enable write tools."
      );
    }
    const allowlist = this.config.write_allowlist;
    if (allowlist && allowlist.length > 0) {
      // Wildcard bypasses all project checks
      if (allowlist.includes("*")) return undefined;
      if (!projectGid) {
        return err(
          "A project_gid is required for write operations when write_allowlist is configured."
        );
      }
      if (!allowlist.includes(projectGid)) {
        log(
          "warning",
          `Blocked write to project ${projectGid} — not in write_allowlist`,
        );
        return err(
          `Write operations are not allowed for project ${projectGid}. ` +
          `Allowed projects: ${allowlist.join(", ")}`
        );
      }
    }
    return undefined;
  }

  async handle(
    name: string,
    args: Record<string, unknown> | undefined
  ): Promise<ToolResult> {
    const a = args ?? {};
    const start = Date.now();
    log("debug", `Tool call: ${name}`, name);

    // Enforce readonly mode: reject write tools when readonly is enabled
    if (this.config.readonly_mode) {
      const schema = TOOL_SCHEMAS.find((t) => t.name === name);
      if (schema && !schema.readonly) {
        log("warning", `Blocked write tool "${name}" — server is in readonly mode`, name);
        logToolCall({ timestamp: new Date().toISOString(), tool: name, args: a, duration_ms: Date.now() - start, status: "blocked", error: "readonly mode" });
        return err(
          `Tool "${name}" is a write operation and is not available in readonly mode. ` +
          `Set ASANA_MCP_READONLY=false to enable write tools.`
        );
      }
    }

    let result: ToolResult;
    try {
      switch (name) {
        case "health_check":
          result = await this.healthCheck(); break;
        case "list_projects":
          result = await this.listProjects(a); break;
        case "get_project":
          result = await this.getProject(a); break;
        case "list_my_tasks":
          result = await this.listMyTasks(a); break;
        case "search_tasks":
          result = await this.searchTasks(a); break;
        case "get_task":
          result = await this.getTask(a); break;
        case "list_project_tasks":
          result = await this.listProjectTasks(a); break;
        case "list_task_stories":
          result = await this.listTaskStories(a); break;
        case "list_sections":
          result = await this.listSections(a); break;
        case "get_project_brief":
          result = await this.getProjectBrief(a); break;
        case "list_portfolios":
          result = await this.listPortfolios(a); break;
        case "get_portfolio":
          result = await this.getPortfolio(a); break;
        case "list_portfolio_items":
          result = await this.listPortfolioItems(a); break;
        case "list_project_status_updates":
          result = await this.listProjectStatusUpdates(a); break;
        case "get_project_status":
          result = await this.getProjectStatus(a); break;
        case "get_notifications":
          result = await this.getNotifications(a); break;
        case "list_forecast":
          result = await this.listForecast(a); break;
        case "list_tags":
          result = await this.listTags(a); break;
        case "create_task":
          result = await this.createTask(a); break;
        case "update_task":
          result = await this.updateTask(a); break;
        case "comment_on_task":
          result = await this.commentOnTask(a); break;
        case "complete_task":
          result = await this.completeTask(a); break;
        case "delete_task":
          result = await this.deleteTask(a); break;
        default:
          logToolCall({ timestamp: new Date().toISOString(), tool: name, duration_ms: Date.now() - start, status: "error", error: "unknown tool" });
          return err(`Unknown tool: ${name}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("error", `Tool error: ${msg}`, name);
      logToolCall({ timestamp: new Date().toISOString(), tool: name, args: a, duration_ms: Date.now() - start, status: "error", error: msg });
      return err(msg);
    }

    const duration = Date.now() - start;
    const status = result.isError ? "error" : "ok";
    logToolCall({
      timestamp: new Date().toISOString(),
      tool: name,
      args: a,
      duration_ms: duration,
      status: status as "ok" | "error",
      ...(result.isError ? { error: result.content[0]?.text } : {}),
    });
    if (duration > 5000) {
      log("warning", `Slow tool call: ${duration}ms`, name);
    }
    return result;
  }

  // --- Tool handlers ---

  private async healthCheck(): Promise<ToolResult> {
    const result = await this.client.healthCheck();
    const availableTools = this.config.readonly_mode
      ? TOOL_SCHEMAS.filter((t) => t.readonly).length
      : TOOL_SCHEMAS.length;
    return ok({
      status: "ok",
      user: result.user,
      workspace: result.workspace,
      version: "0.1.3",
      readonly_mode: this.config.readonly_mode,
      write_allowlist: this.config.write_allowlist ?? null,
      project_allowlist: this.config.project_allowlist ?? null,
      tools_available: availableTools,
    });
  }

  private async listProjects(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const limit = clampLimit(args.limit as number | undefined, this.config);
    const result = await this.client.listProjects({
      archived: args.archived as boolean | undefined,
      team: args.team as string | undefined,
      limit,
      offset: args.offset as string | undefined,
    });

    // Filter by project_allowlist if configured
    let projects = result.items;
    const allowlist = this.config.project_allowlist;
    if (allowlist && allowlist.length > 0) {
      projects = projects.filter((p: unknown) => {
        const gid = (p as { gid?: string }).gid;
        return gid && allowlist.includes(gid);
      });
    }

    return ok({
      count: projects.length,
      next_page: result.next_page,
      projects,
    });
  }

  private async getProject(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const gid = args.project_gid as string;
    if (!gid) return err("project_gid is required");
    const blocked = this.checkProjectAllowed(gid);
    if (blocked) return blocked;
    const project = await this.client.getProject(gid);
    return ok(project);
  }

  private async listMyTasks(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const myGid = await this.getMyGid();
    const limit = clampLimit(args.limit as number | undefined, this.config);
    const completed = (args.completed as boolean | undefined) ?? false;

    const result = await this.client.searchTasks({
      assignee: myGid,
      project: args.project as string | undefined,
      completed,
      due_on_before: args.due_on_before as string | undefined,
      due_on_after: args.due_on_after as string | undefined,
      sort_by: (args.sort_by as string | undefined) ?? "due_date",
      is_subtask: false,
      limit,
      offset: args.offset as string | undefined,
    });

    return ok({ count: result.items.length, next_page: result.next_page, tasks: result.items });
  }

  private async searchTasks(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const limit = clampLimit(args.limit as number | undefined, this.config);
    let assignee = args.assignee as string | undefined;

    if (assignee === "me") {
      assignee = await this.getMyGid();
    }

    const result = await this.client.searchTasks({
      query: args.query as string | undefined,
      assignee,
      project: args.project as string | undefined,
      completed: args.completed as boolean | undefined,
      due_on_before: args.due_on_before as string | undefined,
      due_on_after: args.due_on_after as string | undefined,
      sort_by: args.sort_by as string | undefined,
      limit,
      offset: args.offset as string | undefined,
    });

    return ok({ count: result.items.length, next_page: result.next_page, tasks: result.items });
  }

  private async getTask(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const gid = args.task_gid as string;
    if (!gid) return err("task_gid is required");
    const task = await this.client.getTask(gid);
    return ok(task);
  }

  private async listProjectTasks(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const projectGid = args.project_gid as string;
    if (!projectGid) return err("project_gid is required");
    const blocked = this.checkProjectAllowed(projectGid);
    if (blocked) return blocked;

    const limit = clampLimit(args.limit as number | undefined, this.config);
    const includeCompleted = (args.include_completed as boolean | undefined) ?? false;

    const result = await this.client.listProjectTasks(projectGid, {
      completed_since: includeCompleted ? undefined : "now",
      section: args.section_gid as string | undefined,
      limit,
      offset: args.offset as string | undefined,
    });

    return ok({
      count: result.items.length,
      next_page: result.next_page,
      project_gid: projectGid,
      tasks: result.items,
    });
  }

  private async listTaskStories(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const gid = args.task_gid as string;
    if (!gid) return err("task_gid is required");

    const limit = Math.min(
      (args.limit as number | undefined) ?? 25,
      100
    );

    const result = await this.client.listTaskStories(gid, { limit });
    return ok({ count: result.items.length, next_page: result.next_page, task_gid: gid, stories: result.items });
  }

  private async listSections(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const gid = args.project_gid as string;
    if (!gid) return err("project_gid is required");
    const blocked = this.checkProjectAllowed(gid);
    if (blocked) return blocked;
    const result = await this.client.listSections(gid);
    return ok({
      count: result.items.length,
      next_page: result.next_page,
      project_gid: gid,
      sections: result.items,
    });
  }

  private async getProjectBrief(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const gid = args.project_gid as string;
    if (!gid) return err("project_gid is required");
    const blocked = this.checkProjectAllowed(gid);
    if (blocked) return blocked;

    const brief = await this.client.getProjectBrief(gid);
    if (!brief) {
      return ok({ project_gid: gid, brief: null, message: "No project brief/overview exists for this project." });
    }
    return ok(brief);
  }

  private async getNotifications(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const limit = Math.min(
      (args.limit as number | undefined) ?? 25,
      100
    );

    // Default to 24 hours ago
    let since = args.since as string | undefined;
    if (!since) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      since = yesterday.toISOString();
    }

    const myGid = await this.getMyGid();
    const result = await this.client.searchTasks({
      assignee: myGid,
      modified_at_after: since,
      sort_by: "modified_at",
      is_subtask: false,
      limit,
    });

    return ok({
      count: result.items.length,
      since,
      next_page: result.next_page,
      tasks: result.items,
    });
  }

  private async listForecast(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const limit = clampLimit(args.limit as number | undefined, this.config);
    const today = new Date().toISOString().slice(0, 10);
    const myGid = await this.getMyGid();

    // Fetch overdue + due today in parallel
    const [overdueResult, todayResult] = await Promise.all([
      this.client.searchTasks({
        assignee: myGid,
        completed: false,
        due_on_before: today,
        sort_by: "due_date",
        limit,
      }),
      this.client.searchTasks({
        assignee: myGid,
        completed: false,
        due_on_after: today,
        due_on_before: today,
        sort_by: "due_date",
        limit,
      }),
    ]);

    // Deduplicate by gid (a task due today also matches the overdue search)
    const seen = new Set<string>();
    const tasks: unknown[] = [];
    for (const task of [...overdueResult.items, ...todayResult.items]) {
      const gid = (task as { gid?: string }).gid;
      if (gid && !seen.has(gid)) {
        seen.add(gid);
        tasks.push(task);
      }
    }

    return ok({
      date: today,
      count: tasks.length,
      tasks,
    });
  }

  private async listTags(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const limit = clampLimit(args.limit as number | undefined, this.config);
    const result = await this.client.listTags({ limit });
    return ok({
      count: result.items.length,
      next_page: result.next_page,
      tags: result.items,
    });
  }

  private async listPortfolios(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const limit = clampLimit(args.limit as number | undefined, this.config);
    const result = await this.client.listPortfolios({
      owner: args.owner as string | undefined,
      limit,
      offset: args.offset as string | undefined,
    });
    return ok({
      count: result.items.length,
      next_page: result.next_page,
      portfolios: result.items,
    });
  }

  private async getPortfolio(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const gid = args.portfolio_gid as string;
    if (!gid) return err("portfolio_gid is required");
    const portfolio = await this.client.getPortfolio(gid);
    return ok(portfolio);
  }

  private async listPortfolioItems(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const gid = args.portfolio_gid as string;
    if (!gid) return err("portfolio_gid is required");
    const limit = clampLimit(args.limit as number | undefined, this.config);
    const result = await this.client.listPortfolioItems(gid, {
      limit,
      offset: args.offset as string | undefined,
    });
    return ok({
      count: result.items.length,
      next_page: result.next_page,
      items: result.items,
    });
  }

  private async listProjectStatusUpdates(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const gid = args.project_gid as string;
    if (!gid) return err("project_gid is required");
    const blocked = this.checkProjectAllowed(gid);
    if (blocked) return blocked;
    const limit = clampLimit(args.limit as number | undefined, this.config);
    const result = await this.client.listProjectStatusUpdates(gid, {
      limit,
      offset: args.offset as string | undefined,
    });
    return ok({
      count: result.items.length,
      next_page: result.next_page,
      status_updates: result.items,
    });
  }

  private async getProjectStatus(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const gid = args.status_gid as string;
    if (!gid) return err("status_gid is required");
    const status = await this.client.getProjectStatus(gid);
    return ok(status);
  }

  // --- Write tool handlers ---

  /**
   * For task-level write ops, resolve the task's project GID and assignee
   * so we can check against write_allowlist and allow_write_my_tasks.
   */
  private async resolveTaskContext(taskGid: string): Promise<{
    projectGid: string | undefined;
    assigneeGid: string | undefined;
  }> {
    const task = (await this.client.getTask(taskGid)) as {
      projects?: { gid: string }[];
      assignee?: { gid: string } | null;
    };
    return {
      projectGid: task.projects?.[0]?.gid,
      assigneeGid: task.assignee?.gid,
    };
  }

  /**
   * Check write allowlist for a task, with allow_write_my_tasks bypass
   * for projectless tasks assigned to the authenticated user.
   */
  private async checkTaskWriteAllowed(taskGid: string): Promise<ToolResult | undefined> {
    if (!this.config.write_allowlist?.length) return undefined;

    const { projectGid, assigneeGid } = await this.resolveTaskContext(taskGid);
    const blocked = this.checkWriteAllowed(projectGid);

    // If blocked by allowlist but task is assigned to me, allow the write
    if (blocked && this.config.allow_write_my_tasks) {
      const myGid = await this.getMyGid();
      if (assigneeGid === myGid) {
        log("debug", `Allowing write on task ${taskGid} — assigned to me (allow_write_my_tasks)`);
        return undefined;
      }
    }
    return blocked;
  }

  private async createTask(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const name = args.name as string;
    if (!name) return err("name is required");
    const projectGid = args.project_gid as string;
    if (!projectGid) return err("project_gid is required");

    const blocked = this.checkWriteAllowed(projectGid);
    if (blocked) return blocked;

    let assignee = args.assignee as string | undefined;
    if (assignee === "me") {
      assignee = await this.getMyGid();
    }

    const task = await this.client.createTask({
      name,
      projects: [projectGid],
      notes: args.notes as string | undefined,
      assignee,
      due_on: args.due_on as string | undefined,
      section: args.section_gid as string | undefined,
    });

    log("info", `Created task in project ${projectGid}`, "create_task");
    return ok(task);
  }

  private async updateTask(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const taskGid = args.task_gid as string;
    if (!taskGid) return err("task_gid is required");

    const writeBlocked = await this.checkTaskWriteAllowed(taskGid);
    if (writeBlocked) return writeBlocked;

    const fields: Record<string, unknown> = {};
    if (args.name !== undefined) fields.name = args.name;
    if (args.notes !== undefined) fields.notes = args.notes;
    if (args.completed !== undefined) fields.completed = args.completed;
    if (args.due_on !== undefined) fields.due_on = args.due_on;
    if (args.assignee !== undefined) {
      fields.assignee = args.assignee === "me" ? await this.getMyGid() : args.assignee;
    }

    if (Object.keys(fields).length === 0) {
      return err("At least one field to update is required (name, notes, assignee, due_on, completed).");
    }

    const task = await this.client.updateTask(taskGid, fields);
    log("info", `Updated task ${taskGid}`, "update_task");
    return ok(task);
  }

  private async commentOnTask(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const taskGid = args.task_gid as string;
    if (!taskGid) return err("task_gid is required");
    const text = args.text as string;
    if (!text) return err("text is required");

    const writeBlocked = await this.checkTaskWriteAllowed(taskGid);
    if (writeBlocked) return writeBlocked;

    const story = await this.client.addComment(taskGid, text);
    log("info", `Added comment to task ${taskGid}`, "comment_on_task");
    return ok(story);
  }

  private async completeTask(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const taskGid = args.task_gid as string;
    if (!taskGid) return err("task_gid is required");

    const writeBlocked = await this.checkTaskWriteAllowed(taskGid);
    if (writeBlocked) return writeBlocked;

    const task = await this.client.updateTask(taskGid, { completed: true });
    log("info", `Completed task ${taskGid}`, "complete_task");
    return ok(task);
  }

  private async deleteTask(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const taskGid = args.task_gid as string;
    if (!taskGid) return err("task_gid is required");

    // Delete requires its own opt-in beyond just write access
    if (!this.config.allow_delete) {
      return err(
        "Task deletion is disabled. Set ASANA_MCP_ALLOW_DELETE=true to enable delete operations."
      );
    }

    const writeBlocked = await this.checkTaskWriteAllowed(taskGid);
    if (writeBlocked) return writeBlocked;

    await this.client.deleteTask(taskGid);
    log("info", `Deleted task ${taskGid}`, "delete_task");
    return ok({ deleted: true, task_gid: taskGid });
  }
}
