// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { ApiRoute } from "../http/api.ts";
import {
  kindOptionSectionSchema,
  kindOptionsSchema
} from "./KindOptions.ts";
import {
  accessSectionSchema,
  gameSectionSchema,
  kindFilterSchema,
  physicsSectionSchema,
  projectSectionsSchema,
  snapshotSectionSchema
} from "./ProjectSections.ts";
import { PROJECT_RIGHTS } from "./ProjectRights.ts";

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

export const projectReplySchema = z.record(
  z.enum(PROJECT_RIGHTS),
  z.boolean()
);

export const kindPackageSchema = z.object({
  name: z.string(),
  options: z.record(z.string(), z.unknown()),
  sections: z.array(kindOptionSectionSchema)
});

export const accessChangeSchema = z.object({
  access: accessSectionSchema,
  renamedRoles: z.record(z.string().min(1), z.string().min(1))
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
export type KindPackageSettings = z.infer<typeof kindPackageSchema>;
export type AccessChange = z.infer<typeof accessChangeSchema>;
export type ProjectSettingsReply = z.infer<typeof projectSettingsReplySchema>;
export type SettingsSectionName = z.infer<typeof settingsSectionSchema>;
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
export type SettingsUpdateSections = SettingsUpdate["sections"];
export type SettingsSectionBody<
  TName extends SettingsSectionName = SettingsSectionName
> = z.infer<typeof SETTINGS_SECTIONS[TName]>;
