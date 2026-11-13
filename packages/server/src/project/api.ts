// Import Third-party Dependencies
import * as z from "zod";
import { DEFAULT_SNAPSHOT_POLICY } from "@jolly-pixel/asset-server/client";
import {
  ADMIN_ROLE,
  GUEST_ROLE
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import type { ApiRoute } from "../http/api.ts";

// CONSTANTS
export const PROJECT_URL_PATH = "/api/project/";
export const PROJECT_ROUTES = {
  rights: {
    method: "GET",
    path: ""
  },
  archive: {
    method: "GET",
    path: "archive"
  },
  game: {
    method: "GET",
    path: "game.zip"
  },
  settings: {
    method: "GET",
    path: "settings"
  },
  sections: {
    method: "GET",
    path: "sections"
  },
  replaceSettings: {
    method: "PUT",
    path: "settings"
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

export const gameSectionSchema = z.object({
  start: z.string().min(1).nullable()
});

export const PHYSICS_ENGINES = ["rapier"] as const;

export const physicsSectionSchema = z.object({
  engine: z.enum(PHYSICS_ENGINES),
  gravity: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  })
});

export const DEFAULT_PHYSICS: Readonly<PhysicsSection> = Object.freeze({
  engine: "rapier",
  gravity: Object.freeze({
    x: 0,
    y: -9.81,
    z: 0
  })
});

export const snapshotSectionSchema = z.object({
  delay: z.int().nonnegative(),
  maxDelay: z.int().nonnegative()
});

export const projectSectionsSchema = z.object({
  kindFilter: kindFilterSchema,
  game: gameSectionSchema,
  physics: physicsSectionSchema,
  snapshot: snapshotSectionSchema
});

export const DEFAULT_PROJECT_SECTIONS: Readonly<ProjectSections> = Object.freeze({
  kindFilter: Object.freeze({
    hidden: []
  }),
  game: Object.freeze({
    start: null
  }),
  physics: DEFAULT_PHYSICS,
  snapshot: DEFAULT_SNAPSHOT_POLICY
});

export const projectSettingsReplySchema = z.object({
  ...projectSectionsSchema.shape,
  revision: z.string(),
  name: z.string(),
  editors: z.array(z.string()),
  kinds: z.array(kindPackageSchema),
  access: accessSectionSchema.optional()
});

export const SETTINGS_SECTIONS = {
  kinds: kindOptionsSchema,
  access: accessChangeSchema,
  kindFilter: kindFilterSchema,
  game: gameSectionSchema,
  physics: physicsSectionSchema,
  snapshot: snapshotSectionSchema
} as const;

export const settingsSectionSchema = z.keyof(z.object(SETTINGS_SECTIONS));

export const settingsUpdateSchema = z.object({
  revision: z.string().min(1),
  sections: z.object(SETTINGS_SECTIONS).partial()
});

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
export type GameSection = z.infer<typeof gameSectionSchema>;
export type PhysicsEngine = typeof PHYSICS_ENGINES[number];
export type PhysicsSection = z.infer<typeof physicsSectionSchema>;
export type SnapshotSection = z.infer<typeof snapshotSectionSchema>;
export type ProjectSections = z.infer<typeof projectSectionsSchema>;
export type ProjectSettingsReply = z.infer<typeof projectSettingsReplySchema>;
export type SettingsSectionName = z.infer<typeof settingsSectionSchema>;
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
export type SettingsUpdateSections = SettingsUpdate["sections"];
export type SettingsSectionBody<
  TName extends SettingsSectionName = SettingsSectionName
> = z.infer<typeof SETTINGS_SECTIONS[TName]>;
export type Right = z.infer<typeof rightSchema>;
export type ProjectRight = typeof PROJECT_RIGHTS[number];
export type NamedRight = typeof SETTINGS_RIGHT | typeof AUDIT_RIGHT;

export function namedRight(
  rules: Readonly<Record<string, Right>>,
  name: NamedRight
): Right {
  return Object.hasOwn(rules, name) ? rules[name] : "void";
}
