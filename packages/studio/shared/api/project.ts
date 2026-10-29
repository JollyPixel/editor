// Import Third-party Dependencies
import * as z from "zod";
import {
  ADMIN_ROLE,
  GUEST_ROLE
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import type { ApiRoute } from "./common.ts";

// CONSTANTS
export const PROJECT_URL_PATH = "/api/project/";
export const KINDS_SECTION = "kinds";
export const ACCESS_SECTION = "access";
export const KIND_FILTER_SECTION = "kindFilter";
export const PROJECT_ROUTES = {
  rights: {
    method: "GET",
    path: ""
  },
  archive: {
    method: "GET",
    path: "archive"
  },
  settings: {
    method: "GET",
    path: "settings"
  },
  replaceKinds: {
    method: "PUT",
    path: `settings/${KINDS_SECTION}`
  },
  replaceAccess: {
    method: "PUT",
    path: `settings/${ACCESS_SECTION}`
  },
  kindFilter: {
    method: "GET",
    path: KIND_FILTER_SECTION
  },
  replaceKindFilter: {
    method: "PUT",
    path: `settings/${KIND_FILTER_SECTION}`
  }
} as const satisfies Record<string, ApiRoute>;
export const SHARE_RIGHT = "studio.$share";
export const EXPORT_RIGHT = "studio.$export";
export const SETTINGS_RIGHT = "studio.$settings";
export const AUDIT_RIGHT = "studio.$audit";
export const BUILT_IN_ROLES: readonly string[] = [ADMIN_ROLE, GUEST_ROLE];

export const PROJECT_RIGHTS = [
  "share",
  "export",
  "readSettings",
  "editSettings",
  "audit",
  "manageAccess"
] as const;

export const rightSchema = z.enum(["write", "read", "void"]);

export const projectReplySchema = z.record(
  z.enum(PROJECT_RIGHTS),
  z.boolean()
);

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

export const kindFilterSchema = z.object({
  hidden: z.array(z.string().min(1))
});

export const projectSettingsReplySchema = z.object({
  name: z.string(),
  editors: z.array(z.string()),
  kinds: z.array(kindPackageSchema),
  kindFilter: kindFilterSchema,
  access: accessSectionSchema.optional()
});

export const settingsSectionSchema = z.enum([
  KINDS_SECTION,
  ACCESS_SECTION,
  KIND_FILTER_SECTION
]);

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
export type KindFilterSection = z.infer<typeof kindFilterSchema>;
export type ProjectSettingsReply = z.infer<typeof projectSettingsReplySchema>;
export type SettingsSectionName = z.infer<typeof settingsSectionSchema>;
export type Right = z.infer<typeof rightSchema>;
export type ProjectRight = typeof PROJECT_RIGHTS[number];
export type NamedRight = typeof SETTINGS_RIGHT | typeof AUDIT_RIGHT;

export function namedRight(
  rules: Readonly<Record<string, Right>>,
  name: NamedRight
): Right {
  return Object.hasOwn(rules, name) ? rules[name] : "void";
}
