// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import * as z from "zod";
import {
  PackageResolver,
  ProjectFile,
  ProjectKinds,
  type ProjectFileData,
  type ProjectFileOpenOptions
} from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { EditorPackages } from "../editors/EditorPackages.ts";
import { PrivateFiles } from "./PrivateFiles.ts";
import {
  DEFAULT_ACCESS,
  StudioAccess
} from "./StudioAccess.ts";
import { kindFilterSchema } from "../../shared/api/project.ts";
import { KindFilter } from "../../shared/KindFilter.ts";
import { TEXTURE_SIZE } from "../../shared/seed.ts";

// CONSTANTS
export const PROJECT_ROOT_ENV = "JOLLY_PROJECT";
export const DEFAULT_PROJECT_DIR = "project";
export const STUDIO_ROOT = path.join(import.meta.dirname, "..", "..");
const kSnapshot = {
  delay: 2_000,
  maxDelay: 30_000
};
export const DEFAULT_PROJECT_FILE: ProjectFileData = {
  version: 1,
  editors: [
    "@jolly-pixel/editor.pixel-art",
    "@jolly-pixel/editor.scene",
    "@jolly-pixel/editor.voxel-map",
    "@jolly-pixel/editor.voxel-model"
  ],
  kinds: {
    "@jolly-pixel/asset.pixel-art": {
      defaultSize: TEXTURE_SIZE,
      snapshot: kSnapshot
    },
    "@jolly-pixel/asset.scene": {},
    "@jolly-pixel/asset.voxel-map": {
      blockset: {
        tileSize: 32,
        defaultSize: {
          x: 256,
          y: 256
        },
        snapshot: kSnapshot
      },
      voxelmap: {
        chunkSize: 16,
        snapshot: {
          delay: 5_000,
          maxDelay: 60_000
        }
      }
    },
    "@jolly-pixel/asset.voxel-model": {
      snapshot: kSnapshot
    },
    "@jolly-pixel/asset.voxel-animation": {
      snapshot: kSnapshot
    }
  },
  access: DEFAULT_ACCESS
};
const kSectionsSchema = z.object({
  editors: z.array(z.string().min(1)).default([]),
  kindFilter: kindFilterSchema.default({
    hidden: []
  })
});

export class StudioProject {
  readonly file: ProjectFile;
  readonly editors: EditorPackages;
  readonly kinds: ProjectKinds;
  readonly privateFiles: PrivateFiles;

  #access: StudioAccess;
  #kindFilter: KindFilter;

  static resolveRoot(
    base: string,
    env: NodeJS.ProcessEnv = process.env
  ): string {
    const configured = env[PROJECT_ROOT_ENV]?.trim();

    return path.resolve(
      base,
      configured === undefined || configured === "" ?
        DEFAULT_PROJECT_DIR :
        configured
    );
  }

  static async open(
    root: string,
    options: ProjectFileOpenOptions = {}
  ): Promise<StudioProject> {
    const file = await ProjectFile.open(
      root,
      DEFAULT_PROJECT_FILE,
      options
    );

    const resolver = new PackageResolver(file.root, {
      fallbacks: [STUDIO_ROOT]
    });
    const sections = kSectionsSchema.safeParse(
      file.data
    );
    if (!sections.success) {
      throw new TypeError(
        `"${file.path}" is invalid:\n${z.prettifyError(sections.error)}`
      );
    }
    const editors = await EditorPackages.read(
      sections.data.editors,
      resolver
    );
    const kinds = await ProjectKinds.load(
      file,
      { resolver }
    );
    const known = new Set(
      kinds.descriptors().map((descriptor) => descriptor.kind)
    );

    return new StudioProject(
      file,
      editors,
      kinds,
      StudioAccess.read(file.data, file.path),
      new KindFilter(
        sections.data.kindFilter.hidden.filter((kind) => known.has(kind))
      )
    );
  }

  constructor(
    file: ProjectFile,
    editors: EditorPackages,
    kinds: ProjectKinds,
    access: StudioAccess,
    kindFilter: KindFilter
  ) {
    this.file = file;
    this.editors = editors;
    this.kinds = kinds;
    this.#access = access;
    this.#kindFilter = kindFilter;
    this.privateFiles = new PrivateFiles(
      file.root,
      kinds.descriptors().map((descriptor) => descriptor.extension)
    );
  }

  get name(): string {
    return path.basename(this.file.root);
  }

  get access(): StudioAccess {
    return this.#access;
  }

  replaceAccess(
    access: StudioAccess
  ): void {
    this.#access = access;
  }

  get kindFilter(): KindFilter {
    return this.#kindFilter;
  }

  replaceKindFilter(
    kindFilter: KindFilter
  ): void {
    this.#kindFilter = kindFilter;
  }
}
