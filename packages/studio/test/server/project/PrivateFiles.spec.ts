// Import Node.js Dependencies
import path from "node:path";
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  isFileLoadingAllowed,
  resolveConfig
} from "vite";
import {
  KindPackage,
  PackageResolver,
  ProjectFile,
  ProjectKinds
} from "@jolly-pixel/asset-server/node";
import { ASSET_KINDS } from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import { EditorPackages } from "../../../server/editors/EditorPackages.ts";
import { StudioAccess } from "../../../server/project/StudioAccess.ts";
import { StudioProject } from "../../../server/project/StudioProject.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

// CONSTANTS
const kPrivatePaths = [
  ".jollypixel/accounts.db",
  ".jollypixel/accounts.db-wal",
  ".jollypixel/events.db",
  "maps/overworld.voxelmap.json",
  "maps/deep/overworld.blockset.json",
  "../other-project/.jollypixel/accounts.db"
];
const kServedPaths = [
  "kinds/my-kind/src/index.ts",
  "node_modules/my-kind/dist/index.js"
];

function voxelMapProject(
  root: string
): StudioProject {
  return new StudioProject(
    new ProjectFile(root, {
      version: 1
    }),
    new EditorPackages([]),
    new ProjectKinds([
      new KindPackage({
        name: "@jolly-pixel/asset.voxel-map",
        options: {},
        descriptors: ASSET_KINDS.descriptors,
        handlers: ASSET_KINDS.handlers()
      })
    ], new PackageResolver(root)),
    StudioAccess.read({}, "project.json")
  );
}

async function loadingAllowed(
  root: string
): Promise<(relative: string) => boolean> {
  const config = await resolveConfig({
    configFile: false,
    logLevel: "silent",
    root,
    server: {
      fs: {
        allow: [path.dirname(root)],
        deny: [...voxelMapProject(root).privateFiles]
      }
    }
  }, "serve");

  return (relative) => isFileLoadingAllowed(
    config,
    path.join(root, relative).split(path.sep).join("/")
  );
}

describe("StudioProject.privateFiles", () => {
  let tempDir: string;

  before(async() => {
    tempDir = await createTempDir("studio-private-files-");
  });

  after(async() => {
    await removeTempDir(tempDir);
  });

  test("keeps Vite from serving the project state, its asset files and any other project state", async() => {
    const allowed = await loadingAllowed(path.join(tempDir, "project"));

    for (const relative of kPrivatePaths) {
      assert.equal(allowed(relative), false, relative);
    }
    for (const relative of kServedPaths) {
      assert.equal(allowed(relative), true, relative);
    }
  });

  test("reads glob syntax in the project root literally", async() => {
    const allowed = await loadingAllowed(
      path.join(tempDir, "[team] project (x86)")
    );

    for (const relative of kPrivatePaths) {
      assert.equal(allowed(relative), false, relative);
    }
    assert.equal(allowed("kinds/my-kind/src/index.ts"), true);
  });

  test("reads a backslash in the project root literally", {
    skip: process.platform === "win32" && "backslash is the path separator"
  }, async() => {
    const allowed = await loadingAllowed(
      path.join(tempDir, "team\\project")
    );

    for (const relative of kPrivatePaths) {
      assert.equal(allowed(relative), false, relative);
    }
    assert.equal(allowed("kinds/my-kind/src/index.ts"), true);
  });
});
