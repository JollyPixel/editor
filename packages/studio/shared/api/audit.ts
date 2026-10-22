// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { settingsSectionSchema } from "./project.ts";

// CONSTANTS
export const AUDIT_URL_PATH = "/api/audit/";
export const AUDIT_CATEGORIES = [
  "edits",
  "structure",
  "accounts",
  "settings"
] as const;
export const ACCOUNTS_CATEGORY = "accounts";

export const auditCategorySchema = z.enum(AUDIT_CATEGORIES);

export const auditQuerySchema = z.object({
  cursor: z.string().optional(),
  actor: z.string().optional(),
  asset: z.string().optional(),
  category: auditCategorySchema.optional(),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional()
});

export const auditActorSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  kind: z.enum(["user", "deleted", "share", "system"])
});

export const auditAssetSchema = z.object({
  id: z.string(),
  path: z.string().nullable()
});

export const auditAccountActivitySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("registered"),
    username: z.string(),
    pending: z.boolean()
  }),
  z.object({
    type: z.literal("approved"),
    username: z.string(),
    role: z.string()
  }),
  z.object({
    type: z.enum(["denied", "owner-transferred", "removed"]),
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
  })
]);

export const auditRowSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("edits"),
    actor: auditActorSchema,
    asset: auditAssetSchema,
    count: z.number(),
    from: z.number(),
    to: z.number()
  }),
  z.object({
    type: z.literal("asset"),
    action: z.enum(["created", "renamed", "replaced", "deleted"]),
    actor: auditActorSchema,
    asset: auditAssetSchema,
    at: z.number(),
    previousPath: z.string().optional()
  }),
  z.object({
    type: z.literal("tag"),
    actor: auditActorSchema,
    asset: auditAssetSchema,
    at: z.number(),
    name: z.string(),
    message: z.string().optional()
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

export type AuditCategory = z.infer<typeof auditCategorySchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
export type AuditActor = z.infer<typeof auditActorSchema>;
export type AuditAsset = z.infer<typeof auditAssetSchema>;
export type AuditAccountActivity = z.infer<typeof auditAccountActivitySchema>;
export type AuditRow = z.infer<typeof auditRowSchema>;
export type AuditPage = z.infer<typeof auditPageSchema>;
