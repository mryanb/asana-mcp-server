import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import type { ServerConfig } from "../models/types.js";
import { ToolRouter } from "../tools/router.js";
import type { AsanaClient } from "../asana-client.js";

// Minimal mock client — only methods the router actually calls
function mockClient(overrides: Partial<AsanaClient> = {}): AsanaClient {
  return {
    getMyUserGid: async () => "123",
    getTask: async () => ({ gid: "t1", projects: [{ gid: "p1" }] }),
    updateTask: async (_gid: string, fields: Record<string, unknown>) => ({
      gid: "t1",
      ...fields,
    }),
    deleteTask: async () => {},
    addComment: async () => ({ gid: "s1", text: "ok" }),
    ...overrides,
  } as unknown as AsanaClient;
}

function baseConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    readonly_mode: true,
    allow_delete: false,
    allow_write_my_tasks: false,
    default_limit: 50,
    max_limit: 200,
    log_level: "error",
    ...overrides,
  };
}

describe("ToolRouter — readonly mode", () => {
  it("blocks write tools when readonly", async () => {
    const router = new ToolRouter(mockClient(), baseConfig());
    const result = await router.handle("create_task", {
      name: "test",
      project_gid: "p1",
    });
    assert.equal(result.isError, true);
    assert.ok(
      result.content[0].text.includes("readonly mode"),
      "should mention readonly mode"
    );
  });

  it("blocks complete_task when readonly", async () => {
    const router = new ToolRouter(mockClient(), baseConfig());
    const result = await router.handle("complete_task", { task_gid: "t1" });
    assert.equal(result.isError, true);
  });

  it("allows read tools when readonly", async () => {
    const router = new ToolRouter(
      mockClient({
        healthCheck: async () => ({
          ok: true,
          user: "Test",
          workspace: "WS",
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig()
    );
    const result = await router.handle("health_check", {});
    assert.equal(result.isError, undefined);
  });
});

describe("ToolRouter — write allowlist", () => {
  it("blocks writes to non-allowlisted projects", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({
        readonly_mode: false,
        write_allowlist: ["allowed-project"],
      })
    );
    const result = await router.handle("create_task", {
      name: "test",
      project_gid: "other-project",
    });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("not allowed"));
  });

  it("allows writes to allowlisted projects", async () => {
    const router = new ToolRouter(
      mockClient({
        createTask: async () => ({ gid: "new-task" }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: false,
        write_allowlist: ["p1"],
      })
    );
    const result = await router.handle("create_task", {
      name: "test",
      project_gid: "p1",
    });
    assert.equal(result.isError, undefined);
  });

  it("checks task project for update_task", async () => {
    // Mock getTask returns project p1, which is NOT in allowlist
    const router = new ToolRouter(
      mockClient({
        getTask: async () => ({
          gid: "t1",
          projects: [{ gid: "blocked-project" }],
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: false,
        write_allowlist: ["allowed-project"],
      })
    );
    const result = await router.handle("update_task", {
      task_gid: "t1",
      name: "renamed",
    });
    assert.equal(result.isError, true);
  });
});

describe("ToolRouter — wildcard write_allowlist", () => {
  it("allows writes to any project with wildcard", async () => {
    const router = new ToolRouter(
      mockClient({
        createTask: async () => ({ gid: "new-task" }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: false,
        write_allowlist: ["*"],
      })
    );
    const result = await router.handle("create_task", {
      name: "test",
      project_gid: "any-project",
    });
    assert.equal(result.isError, undefined);
  });
});

describe("ToolRouter — allow_write_my_tasks", () => {
  it("allows completing projectless task assigned to me", async () => {
    const router = new ToolRouter(
      mockClient({
        getMyUserGid: async () => "123",
        getTask: async () => ({
          gid: "t1",
          projects: [],
          assignee: { gid: "123" },
        }),
        updateTask: async (_gid: string, fields: Record<string, unknown>) => ({
          gid: "t1",
          ...fields,
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: false,
        allow_write_my_tasks: true,
        write_allowlist: ["some-project"],
      })
    );
    const result = await router.handle("complete_task", { task_gid: "t1" });
    assert.equal(result.isError, undefined);
  });

  it("allows write on task in non-allowlisted project if assigned to me", async () => {
    const router = new ToolRouter(
      mockClient({
        getMyUserGid: async () => "123",
        getTask: async () => ({
          gid: "t1",
          projects: [{ gid: "other-project" }],
          assignee: { gid: "123" },
        }),
        updateTask: async (_gid: string, fields: Record<string, unknown>) => ({
          gid: "t1",
          ...fields,
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: false,
        allow_write_my_tasks: true,
        write_allowlist: ["some-project"],
      })
    );
    const result = await router.handle("update_task", {
      task_gid: "t1",
      name: "renamed",
    });
    assert.equal(result.isError, undefined);
  });

  it("blocks task in non-allowlisted project not assigned to me", async () => {
    const router = new ToolRouter(
      mockClient({
        getMyUserGid: async () => "123",
        getTask: async () => ({
          gid: "t1",
          projects: [{ gid: "other-project" }],
          assignee: { gid: "other-user" },
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: false,
        allow_write_my_tasks: true,
        write_allowlist: ["some-project"],
      })
    );
    const result = await router.handle("update_task", {
      task_gid: "t1",
      name: "renamed",
    });
    assert.equal(result.isError, true);
  });

  it("blocks projectless task not assigned to me", async () => {
    const router = new ToolRouter(
      mockClient({
        getMyUserGid: async () => "123",
        getTask: async () => ({
          gid: "t1",
          projects: [],
          assignee: { gid: "other-user" },
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: false,
        allow_write_my_tasks: true,
        write_allowlist: ["some-project"],
      })
    );
    const result = await router.handle("complete_task", { task_gid: "t1" });
    assert.equal(result.isError, true);
  });
});

describe("ToolRouter — comment_on_task", () => {
  it("adds a comment to an allowlisted project task", async () => {
    const router = new ToolRouter(
      mockClient({
        getTask: async () => ({
          gid: "t1",
          projects: [{ gid: "p1" }],
          assignee: { gid: "123" },
        }),
        addComment: async () => ({
          gid: "s1",
          text: "hello",
          created_by: { name: "Test" },
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: false,
        write_allowlist: ["p1"],
      })
    );
    const result = await router.handle("comment_on_task", {
      task_gid: "t1",
      text: "hello",
    });
    assert.equal(result.isError, undefined);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.text, "hello");
  });

  it("requires text parameter", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({ readonly_mode: false })
    );
    const result = await router.handle("comment_on_task", {
      task_gid: "t1",
    });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("text is required"));
  });

  it("requires task_gid parameter", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({ readonly_mode: false })
    );
    const result = await router.handle("comment_on_task", {
      text: "hello",
    });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("task_gid is required"));
  });

  it("allows comment via allow_write_my_tasks bypass", async () => {
    const router = new ToolRouter(
      mockClient({
        getMyUserGid: async () => "123",
        getTask: async () => ({
          gid: "t1",
          projects: [{ gid: "blocked-project" }],
          assignee: { gid: "123" },
        }),
        addComment: async () => ({
          gid: "s1",
          text: "my comment",
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: false,
        allow_write_my_tasks: true,
        write_allowlist: ["other-project"],
      })
    );
    const result = await router.handle("comment_on_task", {
      task_gid: "t1",
      text: "my comment",
    });
    assert.equal(result.isError, undefined);
  });
});

describe("ToolRouter — project allowlist", () => {
  it("blocks get_project for non-allowlisted project", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({
        readonly_mode: true,
        project_allowlist: ["allowed-p1"],
      })
    );
    const result = await router.handle("get_project", {
      project_gid: "other-project",
    });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("not in the project_allowlist"));
  });

  it("allows get_project for allowlisted project", async () => {
    const router = new ToolRouter(
      mockClient({
        getProject: async () => ({ gid: "allowed-p1", name: "Test" }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: true,
        project_allowlist: ["allowed-p1"],
      })
    );
    const result = await router.handle("get_project", {
      project_gid: "allowed-p1",
    });
    assert.equal(result.isError, undefined);
  });

  it("blocks list_project_tasks for non-allowlisted project", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({
        readonly_mode: true,
        project_allowlist: ["allowed-p1"],
      })
    );
    const result = await router.handle("list_project_tasks", {
      project_gid: "blocked-project",
    });
    assert.equal(result.isError, true);
  });

  it("blocks list_sections for non-allowlisted project", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({
        readonly_mode: true,
        project_allowlist: ["allowed-p1"],
      })
    );
    const result = await router.handle("list_sections", {
      project_gid: "blocked-project",
    });
    assert.equal(result.isError, true);
  });

  it("filters list_projects results by allowlist", async () => {
    const router = new ToolRouter(
      mockClient({
        listProjects: async () => ({
          items: [
            { gid: "p1", name: "Allowed" },
            { gid: "p2", name: "Blocked" },
            { gid: "p3", name: "Also Allowed" },
          ],
          next_page: null,
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({
        readonly_mode: true,
        project_allowlist: ["p1", "p3"],
      })
    );
    const result = await router.handle("list_projects", {});
    assert.equal(result.isError, undefined);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.count, 2);
    assert.equal(data.projects[0].gid, "p1");
    assert.equal(data.projects[1].gid, "p3");
  });

  it("does not filter when no project_allowlist is set", async () => {
    const router = new ToolRouter(
      mockClient({
        listProjects: async () => ({
          items: [
            { gid: "p1", name: "A" },
            { gid: "p2", name: "B" },
          ],
          next_page: null,
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    const result = await router.handle("list_projects", {});
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.count, 2);
  });
});

describe("ToolRouter — list_tags", () => {
  it("returns tags from the workspace", async () => {
    const router = new ToolRouter(
      mockClient({
        listTags: async () => ({
          items: [
            { gid: "tag1", name: "urgent", color: "red" },
            { gid: "tag2", name: "blocked", color: "yellow" },
          ],
          next_page: null,
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    const result = await router.handle("list_tags", {});
    assert.equal(result.isError, undefined);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.count, 2);
    assert.equal(data.tags[0].name, "urgent");
  });
});

describe("ToolRouter — portfolio tools", () => {
  it("lists portfolios", async () => {
    const router = new ToolRouter(
      mockClient({
        listPortfolios: async () => ({
          items: [{ gid: "pf1", name: "Q1 Initiatives" }],
          next_page: null,
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    const result = await router.handle("list_portfolios", {});
    assert.equal(result.isError, undefined);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.count, 1);
    assert.equal(data.portfolios[0].name, "Q1 Initiatives");
  });

  it("gets portfolio details", async () => {
    const router = new ToolRouter(
      mockClient({
        getPortfolio: async () => ({
          gid: "pf1",
          name: "Q1 Initiatives",
          owner: { gid: "u1", name: "Ryan" },
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    const result = await router.handle("get_portfolio", { portfolio_gid: "pf1" });
    assert.equal(result.isError, undefined);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.name, "Q1 Initiatives");
  });

  it("lists portfolio items", async () => {
    const router = new ToolRouter(
      mockClient({
        listPortfolioItems: async () => ({
          items: [
            { gid: "p1", name: "Project A", resource_type: "project" },
            { gid: "p2", name: "Project B", resource_type: "project" },
          ],
          next_page: null,
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    const result = await router.handle("list_portfolio_items", { portfolio_gid: "pf1" });
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.count, 2);
  });
});

describe("ToolRouter — project status tools", () => {
  it("lists project status updates", async () => {
    const router = new ToolRouter(
      mockClient({
        listProjectStatusUpdates: async () => ({
          items: [
            { gid: "s1", title: "On track", status_type: "on_track", created_at: "2026-03-18" },
          ],
          next_page: null,
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    const result = await router.handle("list_project_status_updates", { project_gid: "p1" });
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.count, 1);
    assert.equal(data.status_updates[0].status_type, "on_track");
  });

  it("respects project allowlist", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({ readonly_mode: true, project_allowlist: ["other"] })
    );
    const result = await router.handle("list_project_status_updates", { project_gid: "blocked" });
    assert.equal(result.isError, true);
  });

  it("gets a single status update", async () => {
    const router = new ToolRouter(
      mockClient({
        getProjectStatus: async () => ({
          gid: "s1",
          title: "On track",
          text: "Everything looks good",
          status_type: "on_track",
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    const result = await router.handle("get_project_status", { status_gid: "s1" });
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.text, "Everything looks good");
  });
});

describe("ToolRouter — get_project_brief", () => {
  it("returns brief content when it exists", async () => {
    const router = new ToolRouter(
      mockClient({
        getProjectBrief: async () => ({
          gid: "brief-1",
          title: "Project Overview",
          text: "Goals and status here",
          permalink_url: "https://app.asana.com/...",
        }),
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    const result = await router.handle("get_project_brief", { project_gid: "p1" });
    assert.equal(result.isError, undefined);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.title, "Project Overview");
  });

  it("returns null message when no brief exists", async () => {
    const router = new ToolRouter(
      mockClient({
        getProjectBrief: async () => null,
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    const result = await router.handle("get_project_brief", { project_gid: "p1" });
    assert.equal(result.isError, undefined);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.brief, null);
  });

  it("respects project allowlist", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({ readonly_mode: true, project_allowlist: ["other-project"] })
    );
    const result = await router.handle("get_project_brief", { project_gid: "blocked" });
    assert.equal(result.isError, true);
  });
});

describe("ToolRouter — get_notifications", () => {
  it("returns recently modified tasks assigned to the user", async () => {
    const router = new ToolRouter(
      mockClient({
        getMyUserGid: async () => "user-1",
        searchTasks: async (opts: Record<string, unknown>) => {
          assert.equal(opts.assignee, "user-1");
          assert.ok(opts.modified_at_after);
          assert.equal(opts.sort_by, "modified_at");
          return {
            items: [
              { gid: "t1", name: "Updated task", modified_at: "2026-03-17T00:00:00Z" },
              { gid: "t2", name: "Another update", modified_at: "2026-03-16T23:00:00Z" },
            ],
            next_page: null,
          };
        },
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    const result = await router.handle("get_notifications", {});
    assert.equal(result.isError, undefined);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.count, 2);
    assert.ok(data.since);
    assert.equal(data.tasks[0].name, "Updated task");
  });

  it("accepts a custom since parameter", async () => {
    let capturedSince: string | undefined;
    const router = new ToolRouter(
      mockClient({
        getMyUserGid: async () => "user-1",
        searchTasks: async (opts: Record<string, unknown>) => {
          capturedSince = opts.modified_at_after as string;
          return { items: [], next_page: null };
        },
      } as unknown as Partial<AsanaClient>),
      baseConfig({ readonly_mode: true })
    );
    await router.handle("get_notifications", { since: "2026-03-15" });
    assert.equal(capturedSince, "2026-03-15");
  });
});

describe("ToolRouter — delete gating", () => {
  it("blocks delete when allow_delete is false", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({ readonly_mode: false, allow_delete: false })
    );
    const result = await router.handle("delete_task", { task_gid: "t1" });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("ASANA_MCP_ALLOW_DELETE"));
  });

  it("allows delete when allow_delete is true", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({ readonly_mode: false, allow_delete: true })
    );
    const result = await router.handle("delete_task", { task_gid: "t1" });
    assert.equal(result.isError, undefined);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.deleted, true);
  });

  it("still checks write_allowlist even with delete enabled", async () => {
    const router = new ToolRouter(
      mockClient(),
      baseConfig({
        readonly_mode: false,
        allow_delete: true,
        write_allowlist: ["other-project"],
      })
    );
    // getTask mock returns project p1, not in allowlist
    const result = await router.handle("delete_task", { task_gid: "t1" });
    assert.equal(result.isError, true);
  });
});

describe("ToolRouter — unknown tool", () => {
  it("returns error for unknown tool name", async () => {
    const router = new ToolRouter(mockClient(), baseConfig());
    const result = await router.handle("nonexistent_tool", {});
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Unknown tool"));
  });
});
