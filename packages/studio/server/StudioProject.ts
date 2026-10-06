// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import * as z from "zod";
import {
  PackageResolver,
  ProjectFile,
  ProjectKinds,
  type PackageLoader,
  type ProjectFileData,
  type ProjectFileOpenOptions
} from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { EditorPackages } from "./EditorPackages.ts";
import { TEXTURE_SIZE } from "../src/seed.ts";

// CONSTANTS
export const PROJECT_ROOT_ENV = "JOLLY_PROJECT";
export const DEFAULT_PROJECT_DIR = "project";
export const STUDIO_ROOT = path.join(import.meta.dirname, "..");
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
    "@jolly-pixel/asset.voxel-model": {},
    "@jolly-pixel/asset.voxel-animation": {}
  }
};
const kEditorsSectionSchema = z.object({
  editors: z.array(z.string().min(1)).default([])
});

export interface StudioProjectLoadOptions {
  /**
   * @default the project root, then `STUDIO_ROOT`
   */
  resolver?: PackageResolver;
  /**
   * @default imports the file resolver.resolve returns
   */
  load?: PackageLoader;
}

export interface StudioProjectOpenOptions extends
  StudioProjectLoadOptions,
  ProjectFileOpenOptions {}

export class StudioProject {
  readonly file: ProjectFile;
  readonly editors: EditorPackages;
  readonly kinds: ProjectKinds;

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
    options: StudioProjectOpenOptions = {}
  ): Promise<StudioProject> {
    return StudioProject.load(
      await ProjectFile.open(root, DEFAULT_PROJECT_FILE, options),
      options
    );
  }

  static async load(
    file: ProjectFile,
    options: StudioProjectLoadOptions = {}
  ): Promise<StudioProject> {
    const {
      resolver = new PackageResolver(file.root, {
        fallbacks: [STUDIO_ROOT]
      }),
      load
    } = options;
    const section = kEditorsSectionSchema.safeParse(file.document);
    if (!section.success) {
      throw new TypeError(
        `"${file.path}" is invalid:\n${z.prettifyError(section.error)}`
      );
    }

    return new StudioProject(
      file,
      EditorPackages.read(section.data.editors, resolver),
      await ProjectKinds.load(file, {
        resolver,
        load
      })
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
