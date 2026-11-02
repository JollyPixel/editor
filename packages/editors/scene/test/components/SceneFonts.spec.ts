// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  FontDocument,
  type Typeface
} from "@jolly-pixel/asset.font/client";
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type { SceneAssetContext } from "@jolly-pixel/editor.host/scene";
import type { TextRenderer } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  BUILT_IN_COMPONENTS,
  BUILT_IN_PACKAGE
} from "../../src/components/builtInComponents.ts";
import { SceneComponents } from "../../src/components/SceneComponents.ts";
import { EditAssets } from "../../src/scene/EditAssets.ts";
import { SceneBinding } from "../../src/scene/SceneBinding.ts";
import { createEditWorld } from "../helpers/editWorld.ts";
import { createPrefabScenes } from "../helpers/prefabScenes.ts";

// CONSTANTS
const kTypeface: Typeface = {
  glyphs: {
    A: {
      ha: 700,
      x_min: 0,
      x_max: 600,
      o: "m 0 0 l 0 700 l 600 700 l 600 0 z"
    }
  },
  familyName: "Block",
  ascender: 800,
  descender: -200,
  underlinePosition: -100,
  underlineThickness: 50,
  boundingBox: {
    xMin: 0,
    xMax: 600,
    yMin: -200,
    yMax: 800
  },
  resolution: 1000
};

function textComponent(
  id: string
) {
  return {
    id,
    type: "Text",
    data: {
      text: "A"
    },
    assets: {
      font: {
        kind: "font",
        id: "font-1"
      }
    }
  };
}

function createTextScene() {
  const document = new SceneDocument();
  document.addActor({
    name: "Title",
    components: [textComponent("title"), textComponent("subtitle")]
  });

  const font = new FontDocument();
  const ready = Promise.withResolvers<void>();
  const opened: string[] = [];
  const released: string[] = [];
  const session = {
    assets: {
      open: (_kind: unknown, assetId: string) => {
        opened.push(assetId);

        return {
          document: font,
          ready: ready.promise,
          release: () => released.push(assetId)
        };
      }
    }
  } as unknown as SceneAssetContext;

  const components = new SceneComponents([[BUILT_IN_PACKAGE, BUILT_IN_COMPONENTS]]);
  const assets = new EditAssets(components, session, {
    loaded: () => binding.rebuild()
  });
  const binding = new SceneBinding({
    world: createEditWorld().world,
    document,
    components: components.createDefinitions(),
    assets,
    environment: {
      apply: () => undefined
    },
    prefabs: createPrefabScenes().scenes,
    sceneId: "level"
  });

  return {
    binding,
    assets,
    opened,
    released,
    async loadFont(): Promise<void> {
      font.load(kTypeface);
      ready.resolve();
      await ready.promise;
    }
  };
}

function text(
  binding: SceneBinding,
  id: string
): TextRenderer<unknown> {
  return binding.component(id) as TextRenderer<unknown>;
}

describe("SceneFonts", () => {
  test("builds text before its font loads, then rebuilds it with the font", async() => {
    const { binding, loadFont } = createTextScene();
    assert.equal(text(binding, "title").font, null);

    await loadFont();

    const title = text(binding, "title");
    assert.notEqual(title.font, null);
    assert.ok(title.threeMesh.geometry.getAttribute("position").count > 0);
  });

  test("leases one font once for every component that draws with it", async() => {
    const { binding, assets, opened, released, loadFont } = createTextScene();
    await loadFont();
    assert.equal(text(binding, "title").font, text(binding, "subtitle").font);

    assets.dispose();

    assert.deepEqual(opened, ["font-1"]);
    assert.deepEqual(released, ["font-1"]);
  });
});
