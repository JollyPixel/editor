// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { build } from "vite";
import {
  KindPackage,
  ProjectFile,
  ProjectKinds
} from "@jolly-pixel/asset-server/node";
import {
  ASSET_KINDS,
  TILESET_ASSET,
  VOXEL_MAP_ASSET
} from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import { EditorPackages } from "../../server/EditorPackages.ts";
import { StudioProject } from "../../server/StudioProject.ts";
import {
  handlersModule,
  projectModule,
  projectModulesPlugin,
  PROJECT_MODULE_ID
} from "../../vite/projectModules.ts";
import { voxelMapEditor } from "../helpers/editorPages.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

// CONSTANTS
const kVoxelMapOptions = {
  voxelmap: {
    chunkSize: 8
  }
};

function voxelMapProject(): StudioProject {
  const kindPackage = new KindPackage({
    name: "@jolly-pixel/asset.voxel-map",
    options: kVoxelMapOptions,
    descriptors: ASSET_KINDS.descriptors,
    handlers: ASSET_KINDS.handlers(kVoxelMapOptions)
  });

  return new StudioProject(
    new ProjectFile(path.resolve("project"), {
      version: 1
    }),
    new EditorPackages([voxelMapEditor("/pkg/dist")]),
    new ProjectKinds([kindPackage])
  );
}

describe("projectModule", () => {
  test("exports the editor descriptors and the kind descriptors", () => {
    const editors = JSON.stringify([
      {
        name: "voxel-map",
        kinds: ["voxelmap"]
      }
    ]);
    const kinds = JSON.stringify([TILESET_ASSET, VOXEL_MAP_ASSET]);

    assert.strictEqual(
      projectModule(voxelMapProject()),
      `export const editors = ${editors};\nexport const kinds = ${kinds};\n`
    );
  });
});

describe("handlersModule", () => {
  test("builds the handlers of each kind package with its options", () => {
    assert.strictEqual(
      handlersModule(voxelMapProject().kinds),
      "import { textureAssetKind } from \"@jolly-pixel/asset-server\";\n" +
      "import { ASSET_KINDS as kinds0 } from \"@jolly-pixel/asset.voxel-map\";\n" +
      "\n" +
      "export default function createHandlers() {\n" +
      "  return [\n" +
      "    ...kinds0.handlers({\"voxelmap\":{\"chunkSize\":8}}),\n" +
      "    textureAssetKind()\n" +
      "  ];\n" +
      "}\n"
    );
  });
});

describe("projectModulesPlugin", () => {
  let root: string;

  before(async() => {
    root = await createTempDir("studio-modules-");
    await fs.writeFile(
      path.join(root, "index.html"),
      "<script type=\"module\" src=\"./main.ts\"></script>"
    );
    await fs.writeFile(
      path.join(root, "main.ts"),
      `import { editors } from "${PROJECT_MODULE_ID}";\n` +
      "document.title = JSON.stringify(editors);\n"
    );
  });

  after(async() => {
    await removeTempDir(root);
  });

  test("bundles the project descriptors", async() => {
    const outDir = path.join(root, "out");
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      build: {
        outDir
      },
      plugins: [projectModulesPlugin(voxelMapProject())]
    });

    const assets = await fs.readdir(path.join(outDir, "assets"));
    const bundle = await fs.readFile(
      path.join(outDir, "assets", assets[0]),
      "utf8"
    );
    assert.match(bundle, /voxel-map/);
  });
});
