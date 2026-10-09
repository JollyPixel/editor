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

describe("EditorPackages", () => {
  after(async() => {
    await Promise.all(kRoots.map((root) => removeTempDir(root)));
  });

  test("reads the editor manifest of each located package", async() => {
    const root = await createRoot();
    const voxelMap = await createPackage(path.join(root, "voxel-map"), {
      name: "voxel-map",
      kinds: ["voxelmap"]
    });
    const pixelArt = await createPackage(path.join(root, "pixel-art"), {
      name: "pixel-art",
      kinds: ["pixelart"],
      dist: "dist-page"
    });
    const editors = EditorPackages.read(
      ["./voxel-map", "./pixel-art"],
      new PackageResolver(root)
    );

    assert.deepEqual([...editors], [
      new EditorPackage({
        package: "./voxel-map",
        name: "voxel-map",
        kinds: ["voxelmap"],
        dist: path.join(voxelMap, "dist"),
        prebuilt: false
      }),
      new EditorPackage({
        package: "./pixel-art",
        name: "pixel-art",
        kinds: ["pixelart"],
        dist: path.join(pixelArt, "dist-page"),
        prebuilt: false
      })
    ]);
    assert.deepEqual(editors.descriptors(), [
      {
        name: "voxel-map",
        kinds: ["voxelmap"]
      },
      {
        name: "pixel-art",
        kinds: ["pixelart"]
      }
    ]);
  });

  test("reads the editor packages installed in the studio", () => {
    const [voxelMap, voxelModel, pixelArt] = EditorPackages.read(
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

  test("requires the built page of a package installed in node_modules", async() => {
    const root = await createRoot();
    const directory = await createPackage(
      path.join(root, "node_modules", "editor"),
      {
        name: "voxel-map",
        kinds: ["voxelmap"]
      }
    );
    const dist = path.join(directory, "dist");
    const resolver = new PackageResolver(root);

    assert.throws(
      () => EditorPackages.read(["editor"], resolver),
      {
        name: "TypeError",
        message: `"editor" has no built page at "${dist}".`
      }
    );

    await fs.mkdir(dist);
    const [editor] = EditorPackages.read(["editor"], resolver);

    assert.ok(editor.prebuilt);
  });

  test("rejects a package without an editor manifest", async() => {
    const root = await createRoot();
    await fs.mkdir(path.join(root, "editor"));
    await fs.writeFile(path.join(root, "editor", "package.json"), "{}");

    assert.throws(
      () => EditorPackages.read(["./editor"], new PackageResolver(root)),
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
      { kinds: ["voxelmap"] },
      { name: "voxel-map", kinds: "voxelmap" }
    ];
    for (const manifest of manifests) {
      const root = await createRoot();
      await createPackage(path.join(root, "editor"), manifest);

      assert.throws(
        () => EditorPackages.read(["./editor"], new PackageResolver(root)),
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

    assert.throws(
      () => EditorPackages.read(["./a", "./b"], new PackageResolver(root)),
      /Editor "voxel-map" is declared by both "\.\/a" and "\.\/b"/
    );
  });
});
