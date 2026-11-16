// Import Third-party Dependencies
import * as z from "zod";
import { JOIN_MODES } from "@jolly-pixel/accounts";
import { DEFAULT_SNAPSHOT_POLICY } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { rightSchema } from "./ProjectRights.ts";

// CONSTANTS
export const PHYSICS_ENGINES = ["rapier"] as const;

export const accessSectionSchema = z.object({
  defaultRole: z.string().min(1),
  roles: z.record(
    z.string().min(1),
    z.record(z.string().min(1), rightSchema)
  ),
  join: z.enum(JOIN_MODES)
});

export const kindFilterSchema = z.object({
  hidden: z.array(z.string().min(1))
});

export const gameSectionSchema = z.object({
  start: z.string().min(1).nullable()
});

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

export type AccessSection = z.infer<typeof accessSectionSchema>;
export type KindFilterSection = z.infer<typeof kindFilterSchema>;
export type GameSection = z.infer<typeof gameSectionSchema>;
export type PhysicsEngine = typeof PHYSICS_ENGINES[number];
export type PhysicsSection = z.infer<typeof physicsSectionSchema>;
export type SnapshotSection = z.infer<typeof snapshotSectionSchema>;
export type ProjectSections = z.infer<typeof projectSectionsSchema>;
