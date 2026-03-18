// Normalized Asana data types for MCP tool responses

export interface AsanaProject {
  gid: string;
  name: string;
  notes: string;
  archived: boolean;
  color: string | null;
  owner: { gid: string; name: string } | null;
  team: { gid: string; name: string } | null;
  workspace: { gid: string; name: string } | null;
  due_date: string | null;
  start_on: string | null;
  permalink_url: string;
  modified_at: string;
  created_at: string;
}

export interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  assignee: { gid: string; name: string } | null;
  due_on: string | null;
  due_at: string | null;
  start_on: string | null;
  start_at: string | null;
  projects: { gid: string; name: string }[];
  memberships: { project: { gid: string; name: string }; section: { gid: string; name: string } }[];
  tags: { gid: string; name: string }[];
  notes: string;
  permalink_url: string;
  modified_at: string;
  created_at: string;
  resource_subtype: string;
  completed_at: string | null;
}

export interface AsanaStory {
  gid: string;
  created_at: string;
  created_by: { gid: string; name: string } | null;
  type: string;
  text: string;
  resource_subtype: string;
}

export interface AsanaSection {
  gid: string;
  name: string;
  project: { gid: string; name: string };
  created_at: string;
}

export interface AsanaTag {
  gid: string;
  name: string;
  color: string | null;
  notes: string;
}

export interface AsanaUser {
  gid: string;
  name: string;
  email: string;
}

// Config types

export interface ServerConfig {
  asana_access_token?: string;
  workspace_gid?: string;
  readonly_mode: boolean;
  allow_delete: boolean;
  default_limit: number;
  max_limit: number;
  log_level: "debug" | "info" | "warning" | "error";
  log_file?: string;
  allow_write_my_tasks: boolean;
  project_allowlist?: string[];
  write_allowlist?: string[];
}
