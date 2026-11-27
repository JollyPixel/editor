// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { ApiRoute } from "../http/api.ts";
import { settingsSectionSchema } from "../project/api.ts";

// CONSTANTS
export const AUDIT_URL_PATH = "/api/audit/";
export const AUDIT_ROUTES = {
  page: {
    method: "GET",
    path: ""
  },
  actors: {
    method: "GET",
    path: "actors"
  },
  export: {
    method: "GET",
    path: "export"
  }
} as const satisfies Record<string, ApiRoute>;
export const AUDIT_CATEGORIES = [
  "edits",
  "structure",
  "accounts",
  "settings"
] as const;
export const ACCOUNTS_CATEGORY = "accounts";
export const AUDIT_EXPORT_MIME_TYPE = "text/csv; charset=utf-8";

export const auditCategorySchema = z.enum(AUDIT_CATEGORIES);

export const auditFilterSchema = z.object({
  actor: z.string().optional(),
  asset: z.string().optional(),
  category: auditCategorySchema.optional(),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional()
});

export const auditQuerySchema = z.object({
  ...auditFilterSchema.shape,
  cursor: z.string().optional()
});

export const auditActorSchema = z.object({
  key: z.string(),
  id: z.string().nullable(),
  name: z.string(),
  kind: z.enum(["user", "agent", "deleted", "share", "system"])
});

export const auditAssetSchema = z.object({
  id: z.string(),
  path: z.string().nullable()
});

export const auditVersionsSchema = z.object({
  from: z.string(),
  to: z.string()
});

export const auditAccountActivitySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["registered", "joined"]),
    username: z.string(),
    pending: z.boolean()
  }),
  z.object({
    type: z.enum(["approved", "invited"]),
    username: z.string(),
    role: z.string()
  }),
  z.object({
    type: z.enum(["denied", "owner-transferred", "removed", "deleted"]),
    username: z.string()
  }),
  z.object({
    type: z.literal("role-changed"),
    username: z.string(),
    from: z.string(),
    to: z.string()
  }),
  z.object({
    type: z.enum(["share-link-created", "share-link-revoked"]),
    asset: auditAssetSchema
  }),
  z.object({
    type: z.enum(["agent-token-created", "agent-token-revoked"]),
    name: z.string()
  })
]);

export const auditRowSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("edits"),
    actor: auditActorSchema,
    asset: auditAssetSchema,
    count: z.number(),
    from: z.number(),
    to: z.number(),
    versions: auditVersionsSchema.nullable(),
    summary: z.string().nullable()
  }),
  z.object({
    type: z.literal("asset"),
    action: z.enum(["created", "renamed", "replaced", "restored", "deleted"]),
    actor: auditActorSchema,
    asset: auditAssetSchema,
    at: z.number(),
    previousPath: z.string().optional(),
    tag: z.string().optional()
  }),
  z.object({
    type: z.literal("tag"),
    action: z.enum(["created", "deleted"]),
    actor: auditActorSchema,
    asset: auditAssetSchema,
    at: z.number(),
    name: z.string(),
    message: z.string().optional()
  }),
  z.object({
    type: z.literal("folder"),
    action: z.enum(["created", "moved", "deleted"]),
    actor: auditActorSchema,
    at: z.number(),
    path: z.string(),
    previousPath: z.string().optional()
  }),
  z.object({
    type: z.literal("account"),
    actor: auditActorSchema,
    at: z.number(),
    activity: auditAccountActivitySchema
  }),
  z.object({
    type: z.literal("settings"),
    actor: auditActorSchema,
    at: z.number(),
    section: settingsSectionSchema,
    before: z.unknown(),
    after: z.unknown()
  })
]);

export const auditPageSchema = z.object({
  rows: z.array(auditRowSchema),
  next: z.string().nullable()
});

export const auditActorsSchema = z.array(auditActorSchema);

export type AuditCategory = z.infer<typeof auditCategorySchema>;
export type AuditFilter = z.infer<typeof auditFilterSchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
export type AuditActor = z.infer<typeof auditActorSchema>;
export type AuditAsset = z.infer<typeof auditAssetSchema>;
export type AuditVersions = z.infer<typeof auditVersionsSchema>;
export type AuditAccountActivity = z.infer<typeof auditAccountActivitySchema>;
export type AuditRow = z.infer<typeof auditRowSchema>;
export type AuditPage = z.infer<typeof auditPageSchema>;
