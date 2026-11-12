// Import Node.js Dependencies
import {
  after,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { PackageResolver } from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { EditorPackage } from "#src/node/editors/EditorPackage.ts";
import { EditorPackages } from "#src/node/editors/EditorPackages.ts";
import { StudioProject } from "#src/node/project/StudioProject.ts";
import { FIRST_PARTY_PACKAGES } from "../../helpers/testProject.ts";
import {
  PackageRoots,
  writeEditorPackage
} from "../../helpers/editorPackages.ts";

// CONSTANTS
const kRoots = new PackageRoots();
const kGridScope = {
  name: "voxel-map",
  label: "Voxel map",
  fields: {
    grid: {
      type: "boolean",
      label: "Grid",
      default: true
    }
  }
};
const kPaletteScope = {
  name: "pixel-art",
  label: "Pixel art",
  fields: {
    palette: {
      type: "boolean",
      label: "Palette",
      default: false
    }
  }
};

async function createPreferencesPackage(
  root: string,
  module: string
): Promise<void> {
  const directory = await writeEditorPackage(path.join(root, "editor"), {
    name: "voxel-map",
    kinds: ["voxelmap"],
    preferences: "preferences.mjs"
  });
  await fs.writeFile(path.join(directory, "preferences.mjs"), module);
}

describe("EditorPackages", () => {
  after(() => kRoots.remove());

  test("reads the editor manifest of each located package", async() => {
    const root = await kRoots.create();
    const voxelMap = await writeEditorPackage(path.join(root, "voxel-map"), {
      name: "voxel-map",
      kinds: ["voxelmap"],
      page: "index.html"
    });
    await fs.writeFile(path.join(voxelMap, "index.html"), "");
    const pixelArt = await writeEditorPackage(path.join(root, "pixel-art"), {
      name: "pixel-art",
      kinds: ["pixelart"],
      dist: "dist-page"
    });
    const editors = await EditorPackages.read(
      ["./voxel-map", "./pixel-art"],
      new PackageResolver(root)
    );

    assert.deepEqual([...editors], [
      new EditorPackage({
        package: "./voxel-map",
        name: "voxel-map",
        kinds: ["voxelmap"],
        dist: path.join(voxelMap, "dist"),
        page: {
          kind: "source",
          html: path.join(voxelMap, "index.html")
        },
        preferences: [],
        sharedPreferences: [],
        previewKinds: [],
        sceneComponents: []
      }),
      new EditorPackage({
        package: "./pixel-art",
        name: "pixel-art",
        kinds: ["pixelart"],
        dist: path.join(pixelArt, "dist-page"),
        page: {
          kind: "built"
        },
        preferences: [],
        sharedPreferences: [],
        previewKinds: [],
        sceneComponents: []
      })
    ]);
    assert.deepEqual(editors.descriptors(), [
      {
        name: "voxel-map",
        kinds: ["voxelmap"],
        preferences: [],
        sharedPreferences: [],
        sceneComponents: []
      },
      {
        name: "pixel-art",
        kinds: ["pixelart"],
        preferences: [],
        sharedPreferences: [],
        sceneComponents: []
      }
    ]);
  });

  test("reads the first-party editor packages by name", async() => {
    const [voxelMap, voxelModel, pixelArt] = await EditorPackages.read(
      [
        "@jolly-pixel/editor.voxel-map",
        "@jolly-pixel/editor.voxel-model",
        "@jolly-pixel/editor.pixel-art"
      ],
      StudioProject.resolver(await kRoots.create(), FIRST_PARTY_PACKAGES)
    );

    assert.deepEqual(voxelMap.kinds, ["voxelmap"]);
    assert.deepEqual(voxelModel.kinds, ["voxelmodel"]);
    assert.deepEqual(pixelArt.kinds, ["pixelart"]);
    assert.match(voxelMap.dist, /[\\/]voxel-map[\\/]dist$/);
    assert.match(pixelArt.dist, /[\\/]pixel-art[\\/]dist-page$/);
    assert.strictEqual(voxelMap.page.kind, "source");
  });

  test("reads the scopes the package's module exports by default and as shared", async() => {
    const root = await kRoots.create();
    await createPreferencesPackage(
      root,
      [
        `export default [${JSON.stringify(kGridScope)}];`,
        `export const shared = [${JSON.stringify(kPaletteScope)}];`
      ].join("\n")
    );

    const editors = await EditorPackages.read(
      ["./editor"],
      new PackageResolver(root)
    );
    const [editor] = editors;

    assert.deepEqual(editor.toDescriptor().preferences, [kGridScope]);
    assert.deepEqual(editor.toDescriptor().sharedPreferences, [kPaletteScope]);
    const [{ scopes, shared }] = editors.editorScopes();
    assert.deepEqual(scopes.map((scope) => scope.name), ["voxel-map"]);
    assert.deepEqual(shared.map((scope) => scope.name), ["pixel-art"]);
  });

  test("rejects a preferences module that exports no valid scope", async() => {
    const root = await kRoots.create();
    await createPreferencesPackage(
      root,
      "export default { name: \"Voxel Map\" };"
    );

    await assert.rejects(
      EditorPackages.read(["./editor"], new PackageResolver(root)),
      /"\.\/editor" exports no valid preference scopes/
    );
  });

  test("marks a package installed in node_modules as prebuilt, without its page source", async() => {
    const root = await kRoots.create();
    await writeEditorPackage(
      path.join(root, "node_modules", "editor"),
      {
        name: "voxel-map",
        kinds: ["voxelmap"],
        page: "index.html"
      }
    );
    const [editor] = await EditorPackages.read(
      ["editor"],
      new PackageResolver(root)
    );

    assert.deepEqual(editor.page, { kind: "prebuilt" });
  });

  test("rejects a workspace package whose page source is missing", async() => {
    const root = await kRoots.create();
    const directory = await writeEditorPackage(path.join(root, "voxel-map"), {
      name: "voxel-map",
      kinds: ["voxelmap"],
      page: "index.html"
    });

    await assert.rejects(
      EditorPackages.read(["./voxel-map"], new PackageResolver(root)),
      {
        name: "TypeError",
        message: `"./voxel-map" has no page source at "${path.join(directory, "index.html")}".`
      }
    );
  });
});
