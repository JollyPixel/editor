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
import { EditorPackages } from "#src/node/editors/EditorPackages.ts";
import {
  PackageRoots,
  writeEditorPackage
} from "../../helpers/editorPackages.ts";

// CONSTANTS
const kRoots = new PackageRoots();

describe("EditorPackages manifest", () => {
  after(() => kRoots.remove());

  test("lists the kinds each package previews with its scene contribution", async() => {
    const root = await kRoots.create();
    await writeEditorPackage(
      path.join(root, "voxel-map"),
      {
        name: "voxel-map",
        kinds: ["voxelmap"]
      },
      {
        scene: "./scene",
        sceneComponents: {},
        preview: ["voxelmap"]
      }
    );
    await writeEditorPackage(path.join(root, "sound"), {
      name: "sound",
      kinds: ["sound"]
    });
    const editors = await EditorPackages.read(
      ["./voxel-map", "./sound"],
      new PackageResolver(root)
    );

    assert.deepEqual(
      Array.from(editors, (editor) => editor.previewKinds),
      [["voxelmap"], []]
    );
  });

  test("describes the scene components each package declares", async() => {
    const root = await kRoots.create();
    await writeEditorPackage(
      path.join(root, "voxel-map"),
      {
        name: "voxel-map",
        kinds: ["voxelmap"]
      },
      {
        scene: "./scene",
        sceneComponents: {
          VoxelMap: {
            assets: {
              map: "voxelmap"
            }
          },
          Grid: {}
        }
      }
    );
    const editors = await EditorPackages.read(
      ["./voxel-map"],
      new PackageResolver(root)
    );

    assert.deepEqual(
      editors.descriptors().map((editor) => editor.sceneComponents),
      [[
        {
          type: "VoxelMap",
          assets: {
            map: "voxelmap"
          }
        },
        {
          type: "Grid",
          assets: {}
        }
      ]]
    );
  });

  test("rejects a scene contribution that declares no scene components", async() => {
    const root = await kRoots.create();
    await writeEditorPackage(
      path.join(root, "editor"),
      {
        name: "voxel-map",
        kinds: ["voxelmap"]
      },
      {
        scene: "./scene"
      }
    );

    await assert.rejects(
      EditorPackages.read(["./editor"], new PackageResolver(root)),
      {
        name: "TypeError",
        message: /a "scene" contribution declares its "sceneComponents"/
      }
    );
  });

  test("rejects a scene component slot that names no asset kind", async() => {
    const root = await kRoots.create();
    await writeEditorPackage(
      path.join(root, "editor"),
      {
        name: "voxel-map",
        kinds: ["voxelmap"]
      },
      {
        sceneComponents: {
          VoxelMap: {
            assets: {
              map: 3
            }
          }
        }
      }
    );

    await assert.rejects(
      EditorPackages.read(["./editor"], new PackageResolver(root)),
      {
        name: "TypeError",
        message: /invalid "jollypixel" manifest:\n.*at jollypixel\.sceneComponents\.VoxelMap\.assets\.map/s
      }
    );
  });

  test("rejects two packages declaring the same scene component", async() => {
    const root = await kRoots.create();
    for (const folder of ["a", "b"]) {
      await writeEditorPackage(
        path.join(root, folder),
        {
          name: folder,
          kinds: [folder]
        },
        {
          sceneComponents: {
            Light: {}
          }
        }
      );
    }

    await assert.rejects(
      EditorPackages.read(["./a", "./b"], new PackageResolver(root)),
      /Scene component "Light" is declared by both "\.\/a" and "\.\/b"/
    );
  });

  test("rejects a preview list without a scene contribution", async() => {
    const root = await kRoots.create();
    await writeEditorPackage(
      path.join(root, "editor"),
      {
        name: "voxel-map",
        kinds: ["voxelmap"]
      },
      {
        preview: ["voxelmap"]
      }
    );

    await assert.rejects(
      EditorPackages.read(["./editor"], new PackageResolver(root)),
      {
        name: "TypeError",
        message: /"preview" lists kinds of the "scene" contribution\.\n.*at jollypixel\.preview/s
      }
    );
  });

  test("rejects a package without an editor manifest", async() => {
    const root = await kRoots.create();
    await fs.mkdir(path.join(root, "editor"));
    await fs.writeFile(path.join(root, "editor", "package.json"), "{}");

    await assert.rejects(
      EditorPackages.read(["./editor"], new PackageResolver(root)),
      {
        name: "TypeError",
        message: /"\.\/editor" declares an invalid "jollypixel" manifest:\n.*at jollypixel/s
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
      const root = await kRoots.create();
      await writeEditorPackage(path.join(root, "editor"), manifest);

      await assert.rejects(
        EditorPackages.read(["./editor"], new PackageResolver(root)),
        {
          name: "TypeError",
          message: /"\.\/editor" declares an invalid "jollypixel" manifest/
        }
      );
    }
  });

  test("rejects two packages declaring the same editor", async() => {
    const root = await kRoots.create();
    for (const folder of ["a", "b"]) {
      await writeEditorPackage(path.join(root, folder), {
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
