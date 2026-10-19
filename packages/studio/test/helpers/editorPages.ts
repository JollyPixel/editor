// Import Node.js Dependencies
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";

// Import Third-party Dependencies
import type { Connect } from "vite";
import {
  KindPackage,
  PackageResolver,
  ProjectFile,
  ProjectKinds
} from "@jolly-pixel/asset-server/node";
import { ASSET_KINDS } from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import { EditorPackage } from "../../server/editors/EditorPackage.ts";
import { EditorPackages } from "../../server/editors/EditorPackages.ts";
import { EditorPages } from "../../server/editors/EditorPages.ts";
import { StudioAccess } from "../../server/project/StudioAccess.ts";
import {
  STUDIO_ROOT,
  StudioProject
} from "../../server/project/StudioProject.ts";
import { createTempDir } from "./tempDir.ts";

// CONSTANTS
export const PASS_THROUGH_STATUS = 418;
export const INDEX_HTML = "<!DOCTYPE html><title>Voxel Map Editor</title>";
export const BUNDLE = "export const editor = true;";
export const HASHED_BUNDLE = "assets/index-B-y7Yx-y.js";

export interface PagesServer extends AsyncDisposable {
  fetch(pathname: string, init?: RequestInit): Promise<Response>;
}

export async function createDist(): Promise<string> {
  const parent = await createTempDir("studio-pages-");
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
  prebuilt?: boolean;
  page?: string | null;
}

export function voxelMapEditor(
  dist: string,
  options: VoxelMapEditorOptions = {}
): EditorPackage {
  const {
    name = "voxel-map",
    prebuilt = false,
    page = null
  } = options;

  return new EditorPackage({
    package: `@jolly-pixel/editor.${name}`,
    name,
    kinds: ["voxelmap"],
    dist,
    prebuilt,
    page,
    preferences: []
  });
}

export function voxelMapPages(
  dist: string,
  page: string | null = null
): EditorPages {
  return new EditorPages(
    new EditorPackages([voxelMapEditor(dist, { page })])
  );
}

export function voxelMapProject(
  root: string,
  dist: string
): StudioProject {
  return new StudioProject(
    new ProjectFile(root, {
      version: 1
    }, {
      inMemory: true
    }),
    new EditorPackages([voxelMapEditor(dist)]),
    new ProjectKinds([
      new KindPackage({
        name: "@jolly-pixel/asset.voxel-map",
        options: {},
        descriptors: ASSET_KINDS.descriptors,
        handlers: ASSET_KINDS.handlers()
      })
    ], new PackageResolver(root, {
      fallbacks: [STUDIO_ROOT]
    })),
    StudioAccess.read({}, "project.json")
  );
}

export async function listen(
  handler: Connect.NextHandleFunction
): Promise<PagesServer> {
  const server = http.createServer((request, response) => {
    handler(request, response, () => {
      response.statusCode = PASS_THROUGH_STATUS;
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
