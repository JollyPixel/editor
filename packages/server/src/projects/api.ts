// Import Third-party Dependencies
import * as z from "zod";
import { accountSchema } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import type { ApiRoute } from "../http/api.ts";

// CONSTANTS
export const PROJECTS_URL_PATH = "/api/projects/";
export const PROJECTS_ROUTES = {
  list: {
    method: "GET",
    path: ""
  },
  create: {
    method: "POST",
    path: ""
  },
  rename: {
    method: "POST",
    path: ":slug/rename"
  },
  remove: {
    method: "DELETE",
    path: ":slug"
  },
  import: {
    method: "POST",
    path: ":slug/import"
  }
} as const satisfies Record<string, ApiRoute>;
export const PROJECT_PAGES_PREFIX = "/p/";
export const PROJECTS_PAGE_DIR = "projects";
export const PROJECT_SLUG_PATTERN = /^[A-Za-z0-9][\w.-]*$/;

export const projectSummarySchema = z.object({
  slug: z.string(),
  role: z.string().nullable(),
  pending: z.boolean(),
  unavailable: z.string().nullable()
});

export const projectsReplySchema = z.object({
  account: accountSchema,
  projects: z.array(projectSummarySchema)
});

export const projectRefSchema = z.object({
  slug: z.string().regex(PROJECT_SLUG_PATTERN).max(64)
});

export const projectSummaryReplySchema = z.object({
  project: projectSummarySchema
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectsReply = z.infer<typeof projectsReplySchema>;
export type ProjectRef = z.infer<typeof projectRefSchema>;
export type ProjectSummaryReply = z.infer<typeof projectSummaryReplySchema>;
