import { log } from "./config/configuration.js";

const ASANA_BASE = "https://app.asana.com/api/1.0";

interface AsanaRequestOptions {
  path: string;
  params?: Record<string, string | undefined>;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
}

interface AsanaResponse<T = unknown> {
  data: T;
  next_page?: { offset: string; uri: string } | null;
}

export class AsanaClient {
  private token: string;
  private defaultWorkspaceGid?: string;

  constructor(token: string, workspaceGid?: string) {
    this.token = token;
    this.defaultWorkspaceGid = workspaceGid;
  }

  get workspaceGid(): string | undefined {
    return this.defaultWorkspaceGid;
  }

  async setDefaultWorkspace(): Promise<void> {
    if (this.defaultWorkspaceGid) return;
    const me = await this.request<{ workspaces: { gid: string; name: string }[] }>({
      path: "/users/me",
      params: { opt_fields: "workspaces.name" },
    });
    if (me.workspaces?.length > 0) {
      this.defaultWorkspaceGid = me.workspaces[0].gid;
      log("info", `Auto-detected workspace: ${me.workspaces[0].name} (${me.workspaces[0].gid})`);
    }
  }

  private async request<T>(opts: AsanaRequestOptions): Promise<T> {
    const url = new URL(`${ASANA_BASE}${opts.path}`);
    if (opts.params) {
      for (const [key, val] of Object.entries(opts.params)) {
        if (val !== undefined && val !== "") {
          url.searchParams.set(key, val);
        }
      }
    }

    const method = opts.method ?? "GET";
    log("debug", `${method} ${url.pathname}${url.search}`);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
    };

    let fetchBody: string | undefined;
    if (opts.body && (method === "POST" || method === "PUT")) {
      headers["Content-Type"] = "application/json";
      fetchBody = JSON.stringify({ data: opts.body });
    }

    const resp = await fetch(url.toString(), {
      method,
      headers,
      body: fetchBody,
    });

    if (!resp.ok) {
      const body = await resp.text();
      log("error", `Asana API error ${resp.status}: ${body}`);
      throw new Error(`Asana API error ${resp.status}: ${body}`);
    }

    // DELETE returns empty body on success
    if (method === "DELETE") {
      return {} as T;
    }

    const json = (await resp.json()) as AsanaResponse<T>;
    return json.data;
  }

  private async requestPaginated<T>(
    opts: AsanaRequestOptions,
    limit: number,
    startOffset?: string
  ): Promise<{ items: T[]; next_page: string | null }> {
    const results: T[] = [];
    let offset: string | undefined = startOffset;
    let nextPageOffset: string | null = null;

    while (results.length < limit) {
      const pageLimit = Math.min(limit - results.length, 100);
      const url = new URL(`${ASANA_BASE}${opts.path}`);
      if (opts.params) {
        for (const [key, val] of Object.entries(opts.params)) {
          if (val !== undefined && val !== "") {
            url.searchParams.set(key, val);
          }
        }
      }
      url.searchParams.set("limit", String(pageLimit));
      if (offset) url.searchParams.set("offset", offset);

      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
        },
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Asana API error ${resp.status}: ${body}`);
      }

      const json = (await resp.json()) as AsanaResponse<T[]>;
      results.push(...json.data);

      if (!json.next_page?.offset) {
        nextPageOffset = null;
        break;
      }
      offset = json.next_page.offset;
      nextPageOffset = json.next_page.offset;
    }

    return { items: results.slice(0, limit), next_page: nextPageOffset };
  }

  // --- Projects ---

  async listProjects(opts: {
    archived?: boolean;
    limit?: number;
    team?: string;
    offset?: string;
  }): Promise<{ items: unknown[]; next_page: string | null }> {
    const params: Record<string, string | undefined> = {
      opt_fields:
        "name,notes,archived,color,owner.name,team.name,workspace.name,due_date,start_on,permalink_url,modified_at,created_at",
      workspace: this.defaultWorkspaceGid,
      archived: opts.archived !== undefined ? String(opts.archived) : undefined,
      team: opts.team,
    };

    return this.requestPaginated({ path: "/projects", params }, opts.limit ?? 50, opts.offset);
  }

  async getProject(projectGid: string): Promise<unknown> {
    return this.request({
      path: `/projects/${projectGid}`,
      params: {
        opt_fields:
          "name,notes,archived,color,owner.name,team.name,workspace.name,due_date,start_on,permalink_url,modified_at,created_at,members.name,current_status.text,current_status.color,current_status.author.name",
      },
    });
  }

  // --- Tasks ---

  async getTask(taskGid: string): Promise<unknown> {
    return this.request({
      path: `/tasks/${taskGid}`,
      params: {
        opt_fields:
          "name,completed,completed_at,assignee.name,due_on,due_at,start_on,start_at,projects.name,memberships.project.name,memberships.section.name,tags.name,notes,permalink_url,modified_at,created_at,resource_subtype",
      },
    });
  }

  async listProjectTasks(
    projectGid: string,
    opts: {
      completed_since?: string;
      limit?: number;
      section?: string;
      offset?: string;
    }
  ): Promise<{ items: unknown[]; next_page: string | null }> {
    if (opts.section) {
      return this.requestPaginated(
        {
          path: `/sections/${opts.section}/tasks`,
          params: {
            opt_fields:
              "name,completed,assignee.name,due_on,due_at,tags.name,notes,permalink_url,modified_at,created_at,resource_subtype,memberships.section.name",
            completed_since: opts.completed_since,
          },
        },
        opts.limit ?? 50,
        opts.offset
      );
    }

    return this.requestPaginated(
      {
        path: `/projects/${projectGid}/tasks`,
        params: {
          opt_fields:
            "name,completed,assignee.name,due_on,due_at,tags.name,notes,permalink_url,modified_at,created_at,resource_subtype,memberships.section.name",
          completed_since: opts.completed_since,
        },
      },
      opts.limit ?? 50,
      opts.offset
    );
  }

  async searchTasks(opts: {
    query?: string;
    assignee?: string;
    project?: string;
    completed?: boolean;
    due_on_before?: string;
    due_on_after?: string;
    modified_at_after?: string;
    is_subtask?: boolean;
    sort_by?: string;
    limit?: number;
    offset?: string;
  }): Promise<{ items: unknown[]; next_page: string | null }> {
    if (!this.defaultWorkspaceGid) {
      throw new Error("Workspace GID required for search");
    }

    const params: Record<string, string | undefined> = {
      opt_fields:
        "name,completed,assignee.name,due_on,due_at,projects.name,tags.name,notes,permalink_url,modified_at,created_at,resource_subtype,memberships.section.name",
      "text": opts.query,
      "assignee.any": opts.assignee,
      "projects.any": opts.project,
      "completed": opts.completed !== undefined ? String(opts.completed) : undefined,
      "due_on.before": opts.due_on_before,
      "due_on.after": opts.due_on_after,
      "modified_at.after": opts.modified_at_after,
      "is_subtask": opts.is_subtask !== undefined ? String(opts.is_subtask) : undefined,
      "sort_by": opts.sort_by ?? "modified_at",
    };

    return this.requestPaginated(
      {
        path: `/workspaces/${this.defaultWorkspaceGid}/tasks/search`,
        params,
      },
      opts.limit ?? 50,
      opts.offset
    );
  }

  async getMyUserGid(): Promise<string> {
    const me = await this.request<{ gid: string }>({
      path: "/users/me",
      params: { opt_fields: "gid" },
    });
    return me.gid;
  }

  // --- Write operations ---

  async createTask(opts: {
    name: string;
    projects: string[];
    notes?: string;
    assignee?: string;
    due_on?: string;
    section?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      name: opts.name,
      projects: opts.projects,
      workspace: this.defaultWorkspaceGid,
    };
    if (opts.notes) body.notes = opts.notes;
    if (opts.assignee) body.assignee = opts.assignee === "me" ? "me" : opts.assignee;
    if (opts.due_on) body.due_on = opts.due_on;

    const task = await this.request<{ gid: string }>({
      path: "/tasks",
      method: "POST",
      body,
      params: {
        opt_fields:
          "name,completed,assignee.name,due_on,projects.name,memberships.project.name,memberships.section.name,notes,permalink_url,created_at",
      },
    });

    // If a section was specified, move the task into it
    if (opts.section) {
      await this.request({
        path: `/sections/${opts.section}/addTask`,
        method: "POST",
        body: { task: task.gid },
      });
    }

    return task;
  }

  async updateTask(
    taskGid: string,
    fields: Record<string, unknown>
  ): Promise<unknown> {
    return this.request({
      path: `/tasks/${taskGid}`,
      method: "PUT",
      body: fields,
      params: {
        opt_fields:
          "name,completed,assignee.name,due_on,projects.name,memberships.project.name,memberships.section.name,notes,permalink_url,modified_at",
      },
    });
  }

  async deleteTask(taskGid: string): Promise<void> {
    await this.request<Record<string, never>>({
      path: `/tasks/${taskGid}`,
      method: "DELETE",
    });
  }

  async addComment(taskGid: string, text: string): Promise<unknown> {
    return this.request({
      path: `/tasks/${taskGid}/stories`,
      method: "POST",
      body: { text },
      params: {
        opt_fields: "created_at,created_by.name,text,type",
      },
    });
  }

  // --- Project Briefs ---

  async getProjectBrief(projectGid: string): Promise<unknown> {
    // First get the project to find its brief GID
    const project = await this.request<{ project_brief?: { gid: string } | null }>({
      path: `/projects/${projectGid}`,
      params: { opt_fields: "project_brief" },
    });

    if (!project.project_brief?.gid) {
      return null;
    }

    return this.request({
      path: `/project_briefs/${project.project_brief.gid}`,
      params: {
        opt_fields: "title,text,html_text,permalink_url",
      },
    });
  }

  // --- Sections ---

  async listSections(projectGid: string): Promise<{ items: unknown[]; next_page: string | null }> {
    return this.requestPaginated(
      {
        path: `/projects/${projectGid}/sections`,
        params: { opt_fields: "name,created_at" },
      },
      100
    );
  }

  // --- Stories ---

  async listTaskStories(
    taskGid: string,
    opts: { limit?: number }
  ): Promise<{ items: unknown[]; next_page: string | null }> {
    return this.requestPaginated(
      {
        path: `/tasks/${taskGid}/stories`,
        params: {
          opt_fields: "created_at,created_by.name,type,text,resource_subtype",
        },
      },
      opts.limit ?? 25
    );
  }

  // --- Tags ---

  async listTags(opts: { limit?: number }): Promise<{ items: unknown[]; next_page: string | null }> {
    return this.requestPaginated(
      {
        path: "/tags",
        params: {
          workspace: this.defaultWorkspaceGid,
          opt_fields: "name,color,notes",
        },
      },
      opts.limit ?? 50
    );
  }

  // --- Health ---

  async healthCheck(): Promise<{ ok: boolean; user: string; workspace: string }> {
    const me = await this.request<{ gid: string; name: string; workspaces: { gid: string; name: string }[] }>({
      path: "/users/me",
      params: { opt_fields: "name,workspaces.name" },
    });

    const ws = me.workspaces?.find((w) => w.gid === this.defaultWorkspaceGid) ?? me.workspaces?.[0];

    return {
      ok: true,
      user: me.name,
      workspace: ws?.name ?? "unknown",
    };
  }
}
