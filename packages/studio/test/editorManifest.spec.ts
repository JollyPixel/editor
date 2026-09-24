// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Import Internal Dependencies
import { readEditorPackages } from "../vite/editorManifest.ts";

async function createPackage(
  editor: unknown
): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-editor-"));
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "editor",
      jollypixel: { editor }
    })
  );

  return root;
}

describe("readEditorPackages", () => {
  test("reads the editor manifest of each located package", async() => {
    const voxelMap = await createPackage({
      name: "voxel-map",
      kinds: ["voxelmap"]
    });
    const pixelArt = await createPackage({
      name: "pixel-art",
      kinds: ["pixelart"],
      dist: "dist-page"
    });
    const roots = new Map([
      ["@jolly-pixel/editor.voxel-map", voxelMap],
      ["@jolly-pixel/editor.pixel-art", pixelArt]
    ]);
    const located: string[] = [];
    const editors = readEditorPackages(roots.keys(), (packageName) => {
      located.push(packageName);

      return roots.get(packageName) ?? "";
    });

    assert.deepEqual(located, [...roots.keys()]);
    assert.deepEqual(editors, [
      {
        package: "@jolly-pixel/editor.voxel-map",
        name: "voxel-map",
        kinds: ["voxelmap"],
        dist: path.join(voxelMap, "dist")
      },
      {
        package: "@jolly-pixel/editor.pixel-art",
        name: "pixel-art",
        kinds: ["pixelart"],
        dist: path.join(pixelArt, "dist-page")
      }
    ]);
  });

  test("reads the editor packages installed in the studio", () => {
    const [voxelMap, voxelModel] = readEditorPackages([
      "@jolly-pixel/editor.voxel-map",
      "@jolly-pixel/editor.voxel-model"
    ]);

    assert.deepEqual(voxelMap.kinds, ["voxelmap"]);
    assert.deepEqual(voxelModel.kinds, ["voxelmodel"]);
    assert.match(voxelMap.dist, /[\\/]voxel-map[\\/]dist$/);
  });

  test("rejects a package without an editor manifest", async() => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-editor-"));
    await fs.writeFile(path.join(root, "package.json"), "{}");

    assert.throws(
      () => readEditorPackages(["editor"], () => root),
      {
        name: "TypeError",
        message: /"editor" declares an invalid "jollypixel.editor" manifest:\n.*at jollypixel/s
      }
    );
  });

  test("rejects an invalid manifest", async() => {
    const manifests = [
      { name: "../escape", kinds: ["voxelmap"] },
      { name: "voxel-map", kinds: [] },
      { name: "voxel-map", kinds: [""] },
      { name: "voxel-map", kinds: ["voxelmap"], dist: 1 },
      { kinds: ["voxelmap"] },
      { name: "voxel-map", kinds: "voxelmap" }
    ];
    for (const manifest of manifests) {
      const root = await createPackage(manifest);

      assert.throws(
        () => readEditorPackages(["editor"], () => root),
        {
          name: "TypeError",
          message: /"editor" declares an invalid "jollypixel.editor" manifest/
        }
      );
    }
  });

  test("rejects two packages declaring the same editor", async() => {
    const root = await createPackage({
      name: "voxel-map",
      kinds: ["voxelmap"]
    });

    assert.throws(
      () => readEditorPackages(["a", "b"], () => root),
      /Editor "voxel-map" is declared by both "a" and "b"/
    );
  });
});
