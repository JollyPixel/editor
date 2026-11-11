// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import * as z from "zod";
import {
  PackageResolver,
  ProjectFile,
  ProjectKinds,
  type PackageResolverOptions,
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
  DEFAULT_PHYSICS,
  gameSectionSchema,
  kindFilterSchema,
  physicsSectionSchema,
  type GameSection,
  type PhysicsSection
} from "../../project/api.ts";
import { KindFilter } from "../../project/KindFilter.ts";

// CONSTANTS
export const DEFAULT_PROJECT_FILE: ProjectFileData = {
  version: 1,
  access: DEFAULT_ACCESS
};
const kSectionsSchema = z.object({
  editors: z.array(z.string().min(1)).default([]),
  kindFilter: kindFilterSchema.default({
    hidden: []
  }),
  game: gameSectionSchema.default({
    start: null
  }),
  physics: physicsSectionSchema.default(DEFAULT_PHYSICS)
});

export interface StudioProjectOpenOptions extends ProjectFileOpenOptions {
  /**
   * Where the editors and kinds of the project file resolve when the project
   * does not install them.
   * @default {}
   */
  packages?: PackageResolverOptions;
  /**
   * The project file written when the root holds none.
   * @default DEFAULT_PROJECT_FILE
   */
  template?: ProjectFileData;
}

export interface StudioProjectSections {
  access: StudioAccess;
  kindFilter: KindFilter;
  game: GameSection;
  physics: PhysicsSection;
}

export class StudioProject {
  readonly file: ProjectFile;
  readonly editors: EditorPackages;
  readonly kinds: ProjectKinds;
  readonly privateFiles: PrivateFiles;

  #access: StudioAccess;
  #kindFilter: KindFilter;
  #game: GameSection;
  #physics: PhysicsSection;

  static resolver(
    root: string,
    packages: PackageResolverOptions = {}
  ): PackageResolver {
    return new PackageResolver(root, packages);
  }

  static async open(
    root: string,
    options: StudioProjectOpenOptions = {}
  ): Promise<StudioProject> {
    const {
      packages,
      template = DEFAULT_PROJECT_FILE,
      ...fileOptions
    } = options;
    const file = await ProjectFile.open(
      root,
      template,
      fileOptions
    );

    const resolver = StudioProject.resolver(file.root, packages);
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
      game: sections.data.game,
      physics: sections.data.physics
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
    this.#game = structuredClone(sections.game);
    this.#physics = structuredClone(sections.physics);
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
    return structuredClone(this.#game);
  }

  replaceGame(
    game: GameSection
  ): void {
    this.#game = structuredClone(game);
  }

  get physics(): PhysicsSection {
    return structuredClone(this.#physics);
  }

  replacePhysics(
    physics: PhysicsSection
  ): void {
    this.#physics = structuredClone(physics);
  }
}
