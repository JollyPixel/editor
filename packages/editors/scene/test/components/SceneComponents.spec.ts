// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import type {
  SceneActorPreset,
  SceneAssetSource,
  SceneComponentKind,
  SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";

// Import Internal Dependencies
import { ActorPresetMenu } from "../../src/features/hierarchy/model/ActorPresetMenu.ts";
import { createSceneComponents } from "../helpers/sceneComponents.ts";

// CONSTANTS
const kMapKind: SceneComponentKind = {
  definition: {
    type: "Map",
    assets: {
      map: new AssetType<unknown>("map")
    },
    parse() {
      return {};
    },
    create() {
      return null;
    }
  },
  label: "Map",
  icon: "actor-map",
  form: () => []
};
const kMapSource: SceneAssetSource = {
  descriptor: {
    kind: "map",
    label: "Map",
    extension: ".map.json"
  },
  documentKinds: [],
  open: () => {
    throw new Error("not opened");
  }
};
const kMapPreset: SceneActorPreset = {
  id: "map",
  label: "Map",
  components: [
    {
      type: "Map",
      data: {}
    }
  ]
};
const kMaps: SceneComponentPackage = {
  components: [kMapKind],
  presets: [kMapPreset],
  assets: [kMapSource]
};

describe("SceneComponents", () => {
  test("adds each package's presets as its own Add menu section after the built-ins", () => {
    const components = createSceneComponents(["maps", kMaps]);
    const menu = new ActorPresetMenu(components);

    assert.strictEqual(menu.entries.at(-2), "separator");
    assert.deepEqual(menu.entries.at(-1), {
      id: "add:map",
      label: "Map…",
      icon: "actor-map"
    });
    assert.ok(menu.find("add:map"));
    assert.ok(menu.find("add:light:spot"));
    assert.deepEqual(components.descriptors, [kMapSource.descriptor]);
  });

  test("refuses a component type, asset kind or preset declared by two packages", () => {
    const cases: [SceneComponentPackage, RegExp][] = [
      [
        { components: [{ ...kMapKind }] },
        /Component type "Map" is declared by both "maps" and "copy"/
      ],
      [
        { components: [], assets: [kMapSource] },
        /Asset kind "map" is declared by both "maps" and "copy"/
      ],
      [
        { components: [], presets: [kMapPreset] },
        /Actor preset "map" is declared by both "maps" and "copy"/
      ],
      [
        { components: [], presets: [{ label: "Maps", presets: [kMapPreset] }] },
        /Actor preset "map" is declared by both "maps" and "copy"/
      ]
    ];

    for (const [copy, message] of cases) {
      assert.throws(
        () => createSceneComponents(["maps", kMaps], ["copy", copy]),
        message
      );
    }
  });

  test("places the actor origin on a corner when any of its kinds grows from it", () => {
    const components = createSceneComponents(["maps", {
      components: [{ ...kMapKind, origin: "corner" }]
    }]);

    assert.strictEqual(components.actorOrigin(["Mesh", "Map"]), "corner");
    assert.strictEqual(components.actorOrigin(["Mesh", "Unknown"]), "center");
  });
});
