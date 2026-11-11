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
import {
  gameSectionSchema,
  kindFilterSchema,
  type GameSection
} from "../../shared/api/project.ts";
import { KindFilter } from "../../shared/KindFilter.ts";
import { TEXTURE_SIZE } from "../../shared/seed.ts";

// CONSTANTS
export const PROJECT_ROOT_ENV = "JOLLY_PROJECT";
export const DEFAULT_PROJECT_DIR = "project";
export const STUDIO_ROOT = path.join(import.meta.dirname, "..", "..");
const kFirstPartyFolders = [
  path.join(STUDIO_ROOT, "..", "assets"),
  path.join(STUDIO_ROOT, "..", "editors")
];
const kSnapshot = {
  delay: 2_000,
  maxDelay: 30_000
};
export const DEFAULT_PROJECT_FILE: ProjectFileData = {
  version: 1,
  editors: [
    "@jolly-pixel/editor.model",
    "@jolly-pixel/editor.pixel-art",
    "@jolly-pixel/editor.scene",
    "@jolly-pixel/editor.script",
    "@jolly-pixel/editor.sound",
    "@jolly-pixel/editor.texture",
    "@jolly-pixel/editor.voxel-map",
    "@jolly-pixel/editor.voxel-model"
  ],
  kinds: {
    "@jolly-pixel/asset.font": {},
    "@jolly-pixel/asset.model": {},
    "@jolly-pixel/asset.pixel-art": {
      defaultSize: TEXTURE_SIZE,
      snapshot: kSnapshot
    },
    "@jolly-pixel/asset.scene": {},
    "@jolly-pixel/asset.script": {},
    "@jolly-pixel/asset.sound": {},
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
  }),
  game: gameSectionSchema.default({
    start: null
  })
});

export interface StudioProjectSections {
  access: StudioAccess;
  kindFilter: KindFilter;
  game: GameSection;
}

export class StudioProject {
  readonly file: ProjectFile;
  readonly editors: EditorPackages;
  readonly kinds: ProjectKinds;
  readonly privateFiles: PrivateFiles;

  #access: StudioAccess;
  #kindFilter: KindFilter;
  #game: GameSection;

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

  static resolver(
    root: string
  ): PackageResolver {
    return new PackageResolver(root, {
      fallbacks: [STUDIO_ROOT],
      searchFolders: kFirstPartyFolders
    });
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

    const resolver = StudioProject.resolver(file.root);
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

    return new StudioProject(file, editors, kinds, {
      access: StudioAccess.read(file.data, file.path),
      kindFilter: new KindFilter(
        sections.data.kindFilter.hidden.filter((kind) => known.has(kind))
      ),
      game: sections.data.game
    });
  }

  constructor(
    file: ProjectFile,
    editors: EditorPackages,
    kinds: ProjectKinds,
    sections: StudioProjectSections
  ) {
    this.file = file;
    this.editors = editors;
    this.kinds = kinds;
    this.#access = sections.access;
    this.#kindFilter = sections.kindFilter;
    this.#game = { ...sections.game };
    this.privateFiles = new PrivateFiles(
      file.root,
      kinds.descriptors().map((descriptor) => descriptor.extension)
    );
  }

  get name(): string {
    return path.basename(this.file.root);
  }

  assetIgnores(): string[] {
    return this.kinds.resolver.ignoreGlobs([
      ...Array.from(this.editors, (editor) => editor.package),
      ...this.kinds.packages.map((kindPackage) => kindPackage.name)
    ]);
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

  get game(): GameSection {
    return { ...this.#game };
  }

  replaceGame(
    game: GameSection
  ): void {
    this.#game = { ...game };
  }
}
