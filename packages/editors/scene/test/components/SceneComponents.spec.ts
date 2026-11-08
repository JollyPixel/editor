// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import { TEXTURE_ASSET } from "@jolly-pixel/asset-server";
import { FONT_ASSET } from "@jolly-pixel/asset.font/client";
import type {
  SceneAssetSource,
  SceneComponentKind,
  SceneComponentPackage,
  SceneComponentSummary
} from "@jolly-pixel/editor.host/scene";
import type { MenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { addComponentEntries } from "../../src/components/addComponentEntries.ts";
import type { DescribedComponent } from "../../src/components/SceneComponents.ts";
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
  category: "3d",
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
const kShaders: SceneComponentPackage = {
  components: [],
  assets: [
    {
      ...kMapSource,
      descriptor: {
        ...kMapSource.descriptor,
        kind: "shader",
        label: "Shader",
        extension: ".tsl.ts"
      }
    }
  ]
};
const kMaps: SceneComponentPackage = {
  components: [kMapKind],
  assets: [kMapSource]
};
const kNotes: SceneComponentPackage = {
  components: [
    {
      definition: {
        type: "Note",
        parse() {
          return {};
        },
        create() {
          return null;
        }
      },
      label: "Note",
      category: "logic",
      form: () => []
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
  test("files the Add component entries into category folders and inlines a lone kind", () => {
    const components = createSceneComponents(["maps", kMaps], ["notes", kNotes]);
    const labels = menuLabels(addComponentEntries(components));
    const folders = new Map(
      labels.filter((label) => typeof label !== "string")
    );

    assert.deepEqual(
      labels.map((label) => (typeof label === "string" ? label : label[0])),
      ["Camera", "Light", "3D", "Rigid body", "Note"]
    );
    assert.deepEqual(folders.get("3D"), ["Mesh", "Text…", "Map…"]);
    assert.deepEqual(components.descriptors, [FONT_ASSET, TEXTURE_ASSET, kMapSource.descriptor]);
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

  test("offers an optional asset slot without asking for it or taking its icon", () => {
    const components = createSceneComponents(["shaders", kShaders]);

    assert.deepEqual(Object.keys(components.assetSlots("Mesh")), ["shader"]);
    assert.deepEqual(components.requiredAssetSlots("Mesh"), {});
    assert.strictEqual(components.icon("Mesh"), "actor-mesh");
  });

  test("hides an optional asset slot whose kind no package opens", () => {
    const components = createSceneComponents();

    assert.deepEqual(components.assetSlots("Mesh"), {});
  });

  test("clears the undeclared slots of a component when its optional slot changes", () => {
    const components = createSceneComponents(["shaders", kShaders]);
    const mesh = {
      type: "Mesh",
      assets: {
        shader: { kind: "shader", id: "wave" },
        "texture:map": { kind: "texture", id: "bricks" },
        "texture:mask": null
      }
    };
    const texture = { kind: "texture", id: "stone" };

    assert.deepEqual(components.assetChange(mesh, "shader", null), {
      shader: null,
      "texture:map": null
    });
    assert.deepEqual(components.assetChange(mesh, "texture:map", texture), {
      "texture:map": texture
    });
  });

  test("refuses a component type or asset kind declared by two packages", () => {
    const cases: [SceneComponentPackage, RegExp][] = [
      [
        { components: [{ ...kMapKind }] },
        /Component type "Map" is declared by both "maps" and "copy"/
      ],
      [
        { components: [], assets: [kMapSource] },
        /Asset kind "map" is declared by both "maps" and "copy"/
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

  test("summarizes a component from its kind's describe, else its first named asset, else its type", () => {
    const components = createSceneComponents(["maps", {
      components: [
        kMapKind,
        {
          ...kMapKind,
          definition: { ...kMapKind.definition, type: "NamedMap" },
          describe: (_data, assets) => {
            return { label: assets.map ?? "Unnamed map" };
          }
        }
      ]
    }]);
    const naming = { name: () => "Overworld" };
    const overworld = { map: { id: "overworld", kind: "map" } };
    const box = { shape: { type: "box" } };
    const cases: [DescribedComponent, SceneComponentSummary][] = [
      [described("Camera"), { label: "Perspective camera" }],
      [described("Camera", { projectionMode: "orthographic" }), { label: "Orthographic camera" }],
      [described("Light", { kind: "spot" }), { label: "Spot light" }],
      [described("Mesh", { geometry: { kind: "torus" } }), { label: "Torus mesh" }],
      [described("Text", { text: "  Press start to play the game\nagain" }), {
        label: "Text",
        detail: "\"Press start to play the…\""
      }],
      [described("Text", { text: "" }), { label: "Text" }],
      [described("RigidBody", { kind: "fixed", colliders: [box] }), { label: "Fixed body", detail: "Box" }],
      [described("RigidBody", { colliders: [box, box] }), { label: "Dynamic body", detail: "2 colliders" }],
      [described("Map", {}, overworld), { label: "Map", detail: "Overworld" }],
      [described("Map", {}, { map: null }), { label: "Map" }],
      [described("NamedMap", {}, overworld), { label: "Overworld" }],
      [described("NamedMap"), { label: "Unnamed map" }],
      [described("Unknown"), { label: "Unknown" }]
    ];

    assert.deepEqual(
      cases.map(([component]) => components.summary(component, naming)),
      cases.map(([, summary]) => summary)
    );
  });
});

function described(
  type: string,
  data: DescribedComponent["data"] = {},
  assets: DescribedComponent["assets"] = {}
): DescribedComponent {
  return {
    type,
    data,
    assets
  };
}
