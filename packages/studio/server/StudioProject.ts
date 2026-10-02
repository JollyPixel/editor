// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import * as z from "zod";
import {
  ProjectFile,
  ProjectKinds,
  type PackageLoader,
  type ProjectFileData
} from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import {
  EditorPackage,
  type PackageLocator
} from "./EditorPackage.ts";
import { EditorPackages } from "./EditorPackages.ts";
import { TEXTURE_SIZE } from "../src/seed.ts";

// CONSTANTS
export const PROJECT_ROOT_ENV = "JOLLY_PROJECT";
export const DEFAULT_PROJECT_DIR = "project";
export const DEFAULT_PROJECT_FILE: ProjectFileData = {
  version: 1,
  editors: [
    "@jolly-pixel/editor.pixel-art",
    "@jolly-pixel/editor.voxel-map",
    "@jolly-pixel/editor.voxel-model"
  ],
  kinds: {
    "@jolly-pixel/asset.pixel-art": {
      defaultSize: TEXTURE_SIZE
    },
    "@jolly-pixel/asset.voxel-map": {},
    "@jolly-pixel/asset.voxel-model": {}
  }
};
const kEditorsSectionSchema = z.object({
  editors: z.array(z.string().min(1)).default([])
});

export interface StudioProjectLoadOptions {
  /**
   * @default EditorPackage.locate
   */
  locate?: PackageLocator;
  /**
   * @default a dynamic import resolved from the studio
   */
  load?: PackageLoader;
}

export class StudioProject {
  readonly file: ProjectFile;
  readonly editors: EditorPackages;
  readonly kinds: ProjectKinds;

  /**
   * Resolves `PROJECT_ROOT_ENV` against `base`, defaulting to
   * `DEFAULT_PROJECT_DIR`.
   */
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

  /**
   * Writes `DEFAULT_PROJECT_FILE` first when the project has no project file.
   */
  static async open(
    root: string,
    options: StudioProjectLoadOptions = {}
  ): Promise<StudioProject> {
    return StudioProject.load(
      await ProjectFile.readOrCreate(root, DEFAULT_PROJECT_FILE),
      options
    );
  }

  static async load(
    file: ProjectFile,
    options: StudioProjectLoadOptions = {}
  ): Promise<StudioProject> {
    const {
      locate = EditorPackage.locate,
      load = (packageName) => import(packageName)
    } = options;
    const section = kEditorsSectionSchema.safeParse(file.document);
    if (!section.success) {
      throw new TypeError(
        `"${file.path}" is invalid:\n${z.prettifyError(section.error)}`
      );
    }

    return new StudioProject(
      file,
      EditorPackages.read(section.data.editors, locate),
      await ProjectKinds.load(file, { load })
    );
  }

  constructor(
    file: ProjectFile,
    editors: EditorPackages,
    kinds: ProjectKinds
  ) {
    this.file = file;
    this.editors = editors;
    this.kinds = kinds;
  }
}
