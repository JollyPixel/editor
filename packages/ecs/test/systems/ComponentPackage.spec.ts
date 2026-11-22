// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  contributedComponents,
  type AssetLoaderDefinition,
  type ComponentPackage
} from "../../src/systems/contributions/ComponentPackage.ts";
import type {
  AnyComponentDefinition
} from "../../src/systems/scene/file/definitions/ComponentDefinitions.ts";
import type {
  JSONObject,
  SceneComponentFile
} from "../../src/systems/scene/file/SceneFile.ts";

function definition(
  type: string
): AnyComponentDefinition {
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
): AssetLoaderDefinition {
  return {
    type: new AssetType(kind),
    create: (): AssetLoader<unknown> => {
      throw new Error("not loaded in this test");
    }
  };
}

function component(
  type: string,
  data: JSONObject
): SceneComponentFile {
  return {
    id: type,
    type,
    data,
    assets: {}
  };
}

describe("contributedComponents", () => {
  test("registers every package's definitions and loaders", () => {
    const voxelLoader = loader("voxelmap");
    const { components, loaders } = contributedComponents([
      [
        "@jolly-pixel/editor.scene",
        {
          definitions: [definition("Camera"), definition("Light")]
        }
      ],
      [
        "@jolly-pixel/editor.voxel-map",
        {
          definitions: [definition("VoxelMap")],
          loaders: [voxelLoader]
        }
      ]
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
    const { usesPhysics } = contributedComponents([
      [
        "@jolly-pixel/editor.scene",
        {
          definitions: [definition("RigidBody"), definition("Camera")],
          usesPhysics: {
            RigidBody: () => true
          }
        }
      ],
      [
        "@jolly-pixel/editor.voxel-map",
        {
          definitions: [definition("VoxelMap")],
          usesPhysics: {
            VoxelMap: (data) => data.collision === true
          }
        }
      ]
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
      () => contributedComponents([
        [
          "@jolly-pixel/editor.scene",
          {
            definitions: [definition("VoxelMap")]
          }
        ],
        [
          "@jolly-pixel/editor.voxel-map",
          {
            definitions: [],
            usesPhysics: {
              VoxelMap: () => true
            }
          }
        ]
      ]),
      {
        name: "TypeError",
        message: "\"@jolly-pixel/editor.voxel-map\" checks physics for " +
          "component type \"VoxelMap\", which it does not declare."
      }
    );
  });

  const kDuplicates: [string, ComponentPackage, string][] = [
    [
      "a component type",
      {
        definitions: [definition("Camera")]
      },
      "Component type \"Camera\" is declared by both \"first\" and \"second\"."
    ],
    [
      "an asset kind",
      {
        definitions: [],
        loaders: [loader("voxelmap")]
      },
      "Asset kind \"voxelmap\" is declared by both \"first\" and \"second\"."
    ]
  ];
  for (const [subject, components, message] of kDuplicates) {
    test(`refuses ${subject} declared by two packages`, () => {
      assert.throws(
        () => contributedComponents([
          ["first", components],
          ["second", components]
        ]),
        {
          name: "TypeError",
          message
        }
      );
    });
  }
});
