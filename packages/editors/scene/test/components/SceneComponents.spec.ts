// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import { FONT_ASSET } from "@jolly-pixel/asset.font/client";
import type {
  SceneActorPreset,
  SceneActorPresetSection,
  SceneAssetSource,
  SceneComponentKind,
  SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import type { MenuEntry } from "@jolly-pixel/ui";

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
    extension: ".map.json",
    icon: {
      svg: "<path d=\"M0 0h24v24H0z\" />"
    }
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
const kMapSection: SceneActorPresetSection = {
  category: "3d",
  presets: [kMapPreset]
};
const kMaps: SceneComponentPackage = {
  components: [kMapKind],
  presets: [kMapSection],
  assets: [kMapSource]
};
const kNotes: SceneComponentPackage = {
  components: [],
  presets: [
    {
      category: "logic",
      presets: [
        {
          id: "note",
          label: "Note",
          components: []
        }
      ]
    }
  ]
};

type MenuLabel = string | [label: string, items: MenuLabel[]];

function menuLabels(
  entries: readonly MenuEntry<string>[]
): MenuLabel[] {
  return entries.map((entry) => {
    if (entry === "separator") {
      return "-";
    }

    return entry.items === undefined ?
      entry.label :
      [entry.label, menuLabels(entry.items)];
  });
}

describe("SceneComponents", () => {
  test("files package presets into category folders and inlines a lone preset", () => {
    const components = createSceneComponents(["maps", kMaps], ["notes", kNotes]);
    const labels = menuLabels(new ActorPresetMenu(components).entries);
    const folders = new Map(
      labels.filter((label) => typeof label !== "string")
    );

    assert.deepEqual(
      labels.map((label) => (typeof label === "string" ? label : label[0])),
      ["Empty", "-", "Camera", "Light", "3D", "Note"]
    );
    assert.deepEqual(folders.get("3D")?.slice(-3), ["-", "Text…", "Map…"]);
    assert.deepEqual(components.descriptors, [FONT_ASSET, kMapSource.descriptor]);
  });

  test("shows the icon of a component's asset kind before its own icon", () => {
    const components = createSceneComponents(["maps", kMaps]);
    const bare = createSceneComponents(["maps", {
      ...kMaps,
      assets: [{ ...kMapSource, descriptor: { ...kMapSource.descriptor, icon: undefined } }]
    }]);

    assert.deepEqual(
      [components.icon("Map"), components.icon("Text"), bare.icon("Map")],
      ["kind:map", "kind:font", "actor-map"]
    );
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
        { components: [], presets: [{ ...kMapSection, category: "logic" }] },
        /Actor preset "map" is declared by both "maps" and "copy"/
      ],
      [
        {
          components: [],
          presets: [{ category: "3d", presets: [{ id: "empty", label: "Blank", components: [] }] }]
        },
        /Actor preset "empty" is declared by both "@jolly-pixel\/editor.scene" and "copy"/
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
