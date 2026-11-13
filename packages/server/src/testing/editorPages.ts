// Import Node.js Dependencies
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

// Import Third-party Dependencies
import {
  KindPackage,
  ProjectFile,
  ProjectKinds
} from "@jolly-pixel/asset-server/node";
import { ASSET_KINDS } from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import {
  EditorPackage,
  type EditorPage
} from "../node/editors/EditorPackage.ts";
import { EditorPackages } from "../node/editors/EditorPackages.ts";
import type { Middleware } from "../node/http/Middleware.ts";
import { StudioAccess } from "../node/project/StudioAccess.ts";
import { StudioProject } from "../node/project/StudioProject.ts";
import { DEFAULT_PROJECT_SECTIONS } from "../project/api.ts";
import { KindFilter } from "../project/KindFilter.ts";
import { PASSED_ON_STATUS } from "./serveBackend.ts";

// CONSTANTS
const kPackageRoot = path.join(import.meta.dirname, "..", "..");
export const INDEX_HTML = "<!DOCTYPE html><title>Voxel Map Editor</title>";
export const BUNDLE = "export const editor = true;";
export const HASHED_BUNDLE = "assets/index-B-y7Yx-y.js";

export interface PagesServer extends AsyncDisposable {
  fetch(pathname: string, init?: RequestInit): Promise<Response>;
}

export async function createDist(): Promise<string> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "studio-pages-"));
  const dist = path.join(parent, "dist");
  await fs.mkdir(path.join(dist, "assets"), { recursive: true });
  await fs.writeFile(path.join(dist, "index.html"), INDEX_HTML);
  await fs.writeFile(path.join(dist, "assets", "index.js"), BUNDLE);
  await fs.writeFile(path.join(dist, HASHED_BUNDLE), BUNDLE);
  await fs.writeFile(path.join(dist, "main.css"), "");
  await fs.writeFile(path.join(parent, "outside.txt"), "secret");
  await fs.writeFile(path.join(dist, ".env"), "secret");
  await fs.symlink(
    parent,
    path.join(dist, "escape"),
    "junction"
  );

  return dist;
}

export interface VoxelMapEditorOptions {
  name?: string;
  page?: EditorPage;
  previewKinds?: readonly string[];
}

export function voxelMapEditor(
  dist: string,
  options: VoxelMapEditorOptions = {}
): EditorPackage {
  const {
    name = "voxel-map",
    page = {
      kind: "built"
    },
    previewKinds = []
  } = options;

  return new EditorPackage({
    package: `@jolly-pixel/editor.${name}`,
    name,
    kinds: ["voxelmap"],
    dist,
    page,
    preferences: [],
    sharedPreferences: [],
    previewKinds,
    sceneComponents: []
  });
}

export function voxelMapProject(
  root: string,
  dist: string,
  editor: VoxelMapEditorOptions = {}
): StudioProject {
  return new StudioProject(
    new ProjectFile(root, {
      version: 1
    }, {
      inMemory: true
    }),
    new EditorPackages([voxelMapEditor(dist, editor)]),
    new ProjectKinds([
      new KindPackage({
        name: "@jolly-pixel/asset.voxel-map",
        kinds: ASSET_KINDS,
        options: {},
        descriptors: ASSET_KINDS.descriptors,
        handlers: ASSET_KINDS.handlers()
      })
    ], StudioProject.resolver(root, {
      fallbacks: [kPackageRoot]
    })),
    {
      ...DEFAULT_PROJECT_SECTIONS,
      access: StudioAccess.read({}, "project.json"),
      kindFilter: KindFilter.NONE
    }
  );
}

export async function listen(
  handler: Middleware
): Promise<PagesServer> {
  const server = http.createServer((request, response) => {
    handler(request, response, () => {
      response.statusCode = PASSED_ON_STATUS;
      response.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  return {
    fetch: (pathname, init) => fetch(
      `http://127.0.0.1:${port}${pathname}`,
      {
        redirect: "manual",
        ...init
      }
    ),
    async [Symbol.asyncDispose]() {
      server.close();
      await once(server, "close");
    }
  };
}
