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
import {
  assertOneOwnerPerComponent,
  readKindSceneComponents
} from "#src/project/node/kindSceneComponents.ts";
import { PackageRoots } from "../../helpers/editorPackages.ts";

// CONSTANTS
const kRoots = new PackageRoots();

async function writeKindPackage(
  directory: string,
  jollypixel: Record<string, unknown> = {}
): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: path.basename(directory),
      jollypixel
    })
  );
}

describe("readKindSceneComponents", () => {
  after(() => kRoots.remove());

  test("lists the scene components a kind package declares", async() => {
    const root = await kRoots.create();
    await writeKindPackage(path.join(root, "voxel-map"), {
      runtime: "./runtime",
      sceneComponents: {
        VoxelMap: {
          assets: {
            map: "voxelmap"
          }
        },
        Grid: {}
      }
    });
    await writeKindPackage(path.join(root, "font"));
    const resolver = new PackageResolver(root);

    assert.deepEqual(readKindSceneComponents("./voxel-map", resolver), [
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
    ]);
    assert.deepEqual(readKindSceneComponents("./font", resolver), []);
  });

  test("rejects a scene component slot that names no asset kind", async() => {
    const root = await kRoots.create();
    await writeKindPackage(path.join(root, "voxel-map"), {
      sceneComponents: {
        VoxelMap: {
          assets: {
            map: 3
          }
        }
      }
    });

    assert.throws(
      () => readKindSceneComponents("./voxel-map", new PackageResolver(root)),
      {
        name: "TypeError",
        message: /invalid "jollypixel\.sceneComponents":\n.*VoxelMap\.assets\.map/s
      }
    );
  });
});

describe("assertOneOwnerPerComponent", () => {
  test("rejects two packages declaring the same scene component", () => {
    const kindPackages = ["./a", "./b"].map((name) => {
      return {
        name,
        kinds: [],
        configurable: false,
        sceneComponents: [
          {
            type: "Light",
            assets: {}
          }
        ]
      };
    });

    assert.throws(
      () => assertOneOwnerPerComponent(kindPackages),
      /Scene component "Light" is declared by both "\.\/a" and "\.\/b"/
    );
  });
});
