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
import { EditorPackages } from "../../editors/node/EditorPackages.ts";
import { PrivateFiles } from "./PrivateFiles.ts";
import {
  DEFAULT_ACCESS,
  StudioAccess
} from "./StudioAccess.ts";
import {
  DEFAULT_PROJECT_SECTIONS,
  projectSectionsSchema,
  type GameSection,
  type PhysicsSection,
  type ProjectSections,
  type SnapshotSection
} from "../ProjectSections.ts";
import { KindFilter } from "../KindFilter.ts";

// CONSTANTS
export const DEFAULT_PROJECT_FILE: ProjectFileData = {
  version: 1,
  access: DEFAULT_ACCESS
};
const kEditorsSchema = z.object({
  editors: z.array(z.string().min(1)).default([])
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

export type ProjectValueSection = "game" | "physics" | "snapshot";

interface ParsedSections extends Pick<ProjectSections, ProjectValueSection> {
  access: StudioAccess;
  kindFilter: KindFilter;
}

export class StudioProject {
  readonly file: ProjectFile;
  readonly editors: EditorPackages;
  readonly kinds: ProjectKinds;
  readonly privateFiles: PrivateFiles;

  #parsedFrom: unknown = null;
  #sections: ParsedSections | null = null;

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
    const { editors } = parseFile(kEditorsSchema, file);
    const project = new StudioProject(
      file,
      await EditorPackages.read(editors, resolver),
      await ProjectKinds.load(file, { resolver })
    );
    project.#parsed();

    return project;
  }

  constructor(
    file: ProjectFile,
    editors: EditorPackages,
    kinds: ProjectKinds
  ) {
    this.file = file;
    this.editors = editors;
    this.kinds = kinds;
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
    return this.#parsed().access;
  }

  get kindFilter(): KindFilter {
    return this.#parsed().kindFilter;
  }

  get game(): GameSection {
    return structuredClone(this.#parsed().game);
  }

  get physics(): PhysicsSection {
    return structuredClone(this.#parsed().physics);
  }

  get snapshot(): SnapshotSection {
    return structuredClone(this.#parsed().snapshot);
  }

  #parsed(): ParsedSections {
    const data = this.file.data;
    if (this.#sections === null || this.#parsedFrom !== data) {
      this.#sections = this.#parse();
      this.#parsedFrom = data;
    }

    return this.#sections;
  }

  #parse(): ParsedSections {
    const sections = parseFile(projectSectionsSchema, this.file);
    const known = new Set(
      this.kinds.descriptors().map((descriptor) => descriptor.kind)
    );

    return {
      access: StudioAccess.read(this.file.data, this.file.path),
      kindFilter: new KindFilter(
        sections.kindFilter.hidden.filter((kind) => known.has(kind))
      ),
      game: sections.game,
      physics: sections.physics,
      snapshot: sections.snapshot
    };
  }
}

function parseFile<TSchema extends z.ZodType>(
  schema: TSchema,
  file: ProjectFile
): z.infer<TSchema> {
  const parsed = schema.safeParse({
    ...DEFAULT_PROJECT_SECTIONS,
    ...file.data
  });
  if (!parsed.success) {
    throw new TypeError(
      `"${file.path}" is invalid:\n${z.prettifyError(parsed.error)}`
    );
  }

  return parsed.data;
}
