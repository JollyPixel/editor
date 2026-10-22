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

export const kindOptionVector2Schema = z.object({
  x: z.number(),
  y: z.number()
});

const kKindOptionFieldShape = {
  path: z.array(z.string()),
  label: z.string(),
  min: z.number().optional(),
  max: z.number().optional()
};

export const kindOptionFieldSchema = z.discriminatedUnion("type", [
  z.object({
    ...kKindOptionFieldShape,
    type: z.literal("number"),
    default: z.number().optional()
  }),
  z.object({
    ...kKindOptionFieldShape,
    type: z.literal("vector2"),
    default: kindOptionVector2Schema
  })
]);

export const kindOptionGroupSchema = z.object({
  path: z.array(z.string()),
  label: z.string(),
  fields: z.array(kindOptionFieldSchema)
});

export const kindOptionSectionSchema = z.object({
  label: z.string().nullable(),
  fields: z.array(kindOptionFieldSchema),
  groups: z.array(kindOptionGroupSchema)
});

export const kindPackageSchema = z.object({
  name: z.string(),
  options: z.record(z.string(), z.unknown()),
  sections: z.array(kindOptionSectionSchema)
});

export const accessSectionSchema = z.object({
  defaultRole: z.string().min(1),
  roles: z.record(
    z.string().min(1),
    z.record(z.string().min(1), rightSchema)
  ),
  accessRequests: z.boolean()
});

export const accessChangeSchema = z.object({
  access: accessSectionSchema,
  renamedRoles: z.record(z.string().min(1), z.string().min(1))
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
export type KindOptionVector2 = z.infer<typeof kindOptionVector2Schema>;
export type KindOptionValue<
  TField extends KindOptionField = KindOptionField
> = TField extends { type: "vector2"; } ? KindOptionVector2 : number;
export type KindOptionGroup = z.infer<typeof kindOptionGroupSchema>;
export type KindOptionSection = z.infer<typeof kindOptionSectionSchema>;
export type KindPackageSettings = z.infer<typeof kindPackageSchema>;
export type AccessSection = z.infer<typeof accessSectionSchema>;
export type AccessChange = z.infer<typeof accessChangeSchema>;
export type ProjectSettingsReply = z.infer<typeof projectSettingsReplySchema>;
export type SettingsSectionName = z.infer<typeof settingsSectionSchema>;
