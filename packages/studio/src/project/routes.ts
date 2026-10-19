// Import Third-party Dependencies
import * as z from "zod";
import {
  ADMIN_ROLE,
  GUEST_ROLE
} from "@jolly-pixel/accounts";

// CONSTANTS
export const PROJECT_URL_PATH = "/api/project/";
export const PROJECT_ARCHIVE_PATH = "archive";
export const PROJECT_SETTINGS_PATH = "settings";
export const KINDS_SECTION = "kinds";
export const ACCESS_SECTION = "access";
export const SETTINGS_RIGHT = "studio.$settings";
export const AUDIT_RIGHT = "studio.$audit";
export const BUILT_IN_ROLES: readonly string[] = [ADMIN_ROLE, GUEST_ROLE];

export const rightSchema = z.enum(["write", "read", "void"]);

export const projectReplySchema = z.object({
  canExport: z.boolean(),
  canReadSettings: z.boolean(),
  canEditSettings: z.boolean(),
  canAudit: z.boolean(),
  canManageAccess: z.boolean()
});

export const kindOptionsSchema = z.record(
  z.string(),
  z.record(z.string(), z.unknown())
);

export const kindOptionFieldSchema = z.object({
  path: z.array(z.string()),
  label: z.string(),
  min: z.number().optional(),
  max: z.number().optional()
});

export const kindPackageSchema = z.object({
  name: z.string(),
  options: z.record(z.string(), z.unknown()),
  fields: z.array(kindOptionFieldSchema)
});

export const accessSectionSchema = z.object({
  defaultRole: z.string().min(1),
  roles: z.record(
    z.string().min(1),
    z.record(z.string().min(1), rightSchema)
  ),
  accessRequests: z.boolean()
});

export const projectSettingsReplySchema = z.object({
  name: z.string(),
  editors: z.array(z.string()),
  kinds: z.array(kindPackageSchema),
  access: accessSectionSchema.optional()
});

export const settingsSectionSchema = z.enum([KINDS_SECTION, ACCESS_SECTION]);

export type ProjectReply = z.infer<typeof projectReplySchema>;
export type KindOptions = z.infer<typeof kindOptionsSchema>;
export type KindOptionField = z.infer<typeof kindOptionFieldSchema>;
export type KindPackageSettings = z.infer<typeof kindPackageSchema>;
export type AccessSection = z.infer<typeof accessSectionSchema>;
export type ProjectSettingsReply = z.infer<typeof projectSettingsReplySchema>;
export type SettingsSectionName = z.infer<typeof settingsSectionSchema>;
