// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader
} from "@jolly-pixel/asset";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  contributedRuntimeComponents,
  type RuntimeContribution
} from "../../../src/three/contributions/RuntimeComponents.ts";
import type {
  RuntimeAssetLoaderDefinition
} from "../../../src/three/assets/RuntimeAssetOptions.ts";

function definition(
  type: string
): Systems.AnyComponentDefinition {
  return {
    type,
    parse: () => {
      return {};
    },
    create: () => null
  };
}

function loader(
  kind: string
): RuntimeAssetLoaderDefinition {
  return {
    type: new AssetType(kind),
    create: (): AssetLoader<unknown> => {
      throw new Error("not loaded in this test");
    }
  };
}

function component(
  type: string,
  data: Systems.JSONObject
): Systems.SceneComponentFile {
  return {
    id: type,
    type,
    data,
    assets: {}
  };
}

describe("contributedRuntimeComponents", () => {
  test("registers every package's definitions and loaders", () => {
    const voxelLoader = loader("voxelmap");
    const { components, loaders } = contributedRuntimeComponents([
      {
        name: "@jolly-pixel/editor.scene",
        module: {
          RUNTIME_COMPONENTS: {
            definitions: [definition("Camera"), definition("Light")]
          }
        }
      },
      {
        name: "@jolly-pixel/editor.voxel-map",
        module: {
          RUNTIME_COMPONENTS: {
            definitions: [definition("VoxelMap")],
            loaders: [voxelLoader]
          }
        }
      }
    ]);

    assert.deepEqual(
      ["Camera", "Light", "VoxelMap"].map(
        (type) => components.find(type)?.type
      ),
      ["Camera", "Light", "VoxelMap"]
    );
    assert.deepEqual(loaders, [voxelLoader]);
  });

  test("a component uses physics when its package's check for its type says so", () => {
    const { usesPhysics } = contributedRuntimeComponents([
      {
        name: "@jolly-pixel/editor.scene",
        module: {
          RUNTIME_COMPONENTS: {
            definitions: [definition("RigidBody"), definition("Camera")],
            usesPhysics: {
              RigidBody: () => true
            }
          }
        }
      },
      {
        name: "@jolly-pixel/editor.voxel-map",
        module: {
          RUNTIME_COMPONENTS: {
            definitions: [definition("VoxelMap")],
            usesPhysics: {
              VoxelMap: (data) => data.collision === true
            }
          }
        }
      }
    ]);

    assert.deepEqual(
      [
        component("RigidBody", {}),
        component("VoxelMap", { collision: true }),
        component("VoxelMap", { collision: false }),
        component("Camera", {})
      ].map(usesPhysics),
      [true, true, false, false]
    );
  });

  test("refuses a physics check for a component type the package does not declare", () => {
    assert.throws(
      () => contributedRuntimeComponents([
        {
          name: "@jolly-pixel/editor.scene",
          module: {
            RUNTIME_COMPONENTS: {
              definitions: [definition("VoxelMap")]
            }
          }
        },
        {
          name: "@jolly-pixel/editor.voxel-map",
          module: {
            RUNTIME_COMPONENTS: {
              definitions: [],
              usesPhysics: {
                VoxelMap: () => true
              }
            }
          }
        }
      ]),
      {
        name: "TypeError",
        message: "\"@jolly-pixel/editor.voxel-map\" checks physics for " +
          "component type \"VoxelMap\", which it does not declare."
      }
    );
  });

  test("names the package that declares the field without the export", () => {
    assert.throws(
      () => contributedRuntimeComponents([
        {
          name: "@jolly-pixel/editor.model",
          module: {}
        }
      ]),
      {
        name: "TypeError",
        message: "\"@jolly-pixel/editor.model\" declares \"jollypixel.runtime\" " +
          "but does not export \"RUNTIME_COMPONENTS\"."
      }
    );
  });

  const kDuplicates: [string, RuntimeContribution["module"], string][] = [
    [
      "a component type",
      {
        RUNTIME_COMPONENTS: {
          definitions: [definition("Camera")]
        }
      },
      "Component type \"Camera\" is declared by both \"first\" and \"second\"."
    ],
    [
      "an asset kind",
      {
        RUNTIME_COMPONENTS: {
          definitions: [],
          loaders: [loader("voxelmap")]
        }
      },
      "Asset kind \"voxelmap\" is declared by both \"first\" and \"second\"."
    ]
  ];
  for (const [subject, module, message] of kDuplicates) {
    test(`refuses ${subject} declared by two packages`, () => {
      assert.throws(
        () => contributedRuntimeComponents([
          {
            name: "first",
            module
          },
          {
            name: "second",
            module
          }
        ]),
        {
          name: "TypeError",
          message
        }
      );
    });
  }
});
