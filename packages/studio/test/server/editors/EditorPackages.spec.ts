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
import { EditorPackage } from "../../../server/editors/EditorPackage.ts";
import { EditorPackages } from "../../../server/editors/EditorPackages.ts";
import { STUDIO_ROOT } from "../../../server/project/StudioProject.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

// CONSTANTS
const kRoots: string[] = [];
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

async function createRoot(): Promise<string> {
  const root = await fs.realpath(await createTempDir("studio-editor-"));
  kRoots.push(root);

  return root;
}

async function createPackage(
  directory: string,
  editor: unknown
): Promise<string> {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: "editor",
      jollypixel: { editor }
    })
  );

  return directory;
}

async function createPreferencesPackage(
  root: string,
  module: string
): Promise<void> {
  const directory = await createPackage(path.join(root, "editor"), {
    name: "voxel-map",
    kinds: ["voxelmap"],
    preferences: "preferences.mjs"
  });
  await fs.writeFile(path.join(directory, "preferences.mjs"), module);
}

describe("EditorPackages", () => {
  after(async() => {
    await Promise.all(kRoots.map((root) => removeTempDir(root)));
  });

  test("reads the editor manifest of each located package", async() => {
    const root = await createRoot();
    const voxelMap = await createPackage(path.join(root, "voxel-map"), {
      name: "voxel-map",
      kinds: ["voxelmap"],
      page: "index.html"
    });
    await fs.writeFile(path.join(voxelMap, "index.html"), "");
    const pixelArt = await createPackage(path.join(root, "pixel-art"), {
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
        prebuilt: false,
        page: path.join(voxelMap, "index.html"),
        preferences: [],
        sharedPreferences: []
      }),
      new EditorPackage({
        package: "./pixel-art",
        name: "pixel-art",
        kinds: ["pixelart"],
        dist: path.join(pixelArt, "dist-page"),
        prebuilt: false,
        page: null,
        preferences: [],
        sharedPreferences: []
      })
    ]);
    assert.deepEqual(editors.descriptors(), [
      {
        name: "voxel-map",
        kinds: ["voxelmap"],
        preferences: [],
        sharedPreferences: []
      },
      {
        name: "pixel-art",
        kinds: ["pixelart"],
        preferences: [],
        sharedPreferences: []
      }
    ]);
  });

  test("reads the editor packages installed in the studio", async() => {
    const [voxelMap, voxelModel, pixelArt] = await EditorPackages.read(
      [
        "@jolly-pixel/editor.voxel-map",
        "@jolly-pixel/editor.voxel-model",
        "@jolly-pixel/editor.pixel-art"
      ],
      new PackageResolver(STUDIO_ROOT)
    );

    assert.deepEqual(voxelMap.kinds, ["voxelmap"]);
    assert.deepEqual(voxelModel.kinds, ["voxelmodel"]);
    assert.deepEqual(pixelArt.kinds, ["pixelart"]);
    assert.match(voxelMap.dist, /[\\/]voxel-map[\\/]dist$/);
    assert.match(pixelArt.dist, /[\\/]pixel-art[\\/]dist-page$/);
    assert.ok(!voxelMap.prebuilt);
  });

  test("reads the scopes the package's module exports by default and as shared", async() => {
    const root = await createRoot();
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
    assert.deepEqual(
      editors.preferences().map((scope) => scope.name),
      ["voxel-map", "pixel-art"]
    );
  });

  test("rejects a preferences module that exports no valid scope", async() => {
    const root = await createRoot();
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
    const root = await createRoot();
    await createPackage(
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

    assert.ok(editor.prebuilt);
    assert.strictEqual(editor.page, null);
  });

  test("rejects a workspace package whose page source is missing", async() => {
    const root = await createRoot();
    const directory = await createPackage(path.join(root, "voxel-map"), {
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

  test("rejects a package without an editor manifest", async() => {
    const root = await createRoot();
    await fs.mkdir(path.join(root, "editor"));
    await fs.writeFile(path.join(root, "editor", "package.json"), "{}");

    await assert.rejects(
      EditorPackages.read(["./editor"], new PackageResolver(root)),
      {
        name: "TypeError",
        message: /"\.\/editor" declares an invalid "jollypixel.editor" manifest:\n.*at jollypixel/s
      }
    );
  });

  test("rejects an invalid manifest", async() => {
    const manifests = [
      { name: "../escape", kinds: ["voxelmap"] },
      { name: "voxel-map", kinds: [] },
      { name: "voxel-map", kinds: [""] },
      { name: "voxel-map", kinds: ["voxelmap"], dist: 1 },
      { name: "voxel-map", kinds: ["voxelmap"], page: "" },
      { name: "voxel-map", kinds: ["voxelmap"], preferences: "" },
      { kinds: ["voxelmap"] },
      { name: "voxel-map", kinds: "voxelmap" }
    ];
    for (const manifest of manifests) {
      const root = await createRoot();
      await createPackage(path.join(root, "editor"), manifest);

      await assert.rejects(
        EditorPackages.read(["./editor"], new PackageResolver(root)),
        {
          name: "TypeError",
          message: /"\.\/editor" declares an invalid "jollypixel.editor" manifest/
        }
      );
    }
  });

  test("rejects two packages declaring the same editor", async() => {
    const root = await createRoot();
    for (const folder of ["a", "b"]) {
      await createPackage(path.join(root, folder), {
        name: "voxel-map",
        kinds: ["voxelmap"]
      });
    }

    await assert.rejects(
      EditorPackages.read(["./a", "./b"], new PackageResolver(root)),
      /Editor "voxel-map" is declared by both "\.\/a" and "\.\/b"/
    );
  });
});
