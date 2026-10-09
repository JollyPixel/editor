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
import { EditorPackages } from "./EditorPackages.ts";
import { StudioAccess } from "./StudioAccess.ts";
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

export class StudioProject {
  readonly file: ProjectFile;
  readonly editors: EditorPackages;
  readonly kinds: ProjectKinds;
  readonly access: StudioAccess;

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
    const section = kEditorsSectionSchema.safeParse(
      file.document
    );
    if (!section.success) {
      throw new TypeError(
        `"${file.path}" is invalid:\n${z.prettifyError(section.error)}`
      );
    }

    return new StudioProject(
      file,
      EditorPackages.read(
        section.data.editors,
        resolver
      ),
      await ProjectKinds.load(
        file,
        { resolver }
      ),
      StudioAccess.read(file.document, file.path)
    );
  }

  constructor(
    file: ProjectFile,
    editors: EditorPackages,
    kinds: ProjectKinds,
    access: StudioAccess
  ) {
    this.file = file;
    this.editors = editors;
    this.kinds = kinds;
    this.access = access;
  }
}
