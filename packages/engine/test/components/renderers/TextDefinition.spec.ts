// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../../../src/core/actor/Actor.ts";
import { TextDefinition } from "../../../src/three/components/renderers/text/TextDefinition.ts";
import {
  ComponentAssets
} from "../../../src/core/systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../../src/core/systems/scene/file/SceneFile.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";
import { blockFont } from "../../helpers/text/blockFont.ts";

// CONSTANTS
const kFontReference: AssetReferenceData = {
  kind: "font",
  id: "font-1"
};

function createText(
  data: JSONObject,
  font: ReturnType<typeof blockFont> | null
) {
  const { world } = createSceneSetup();
  const actor = new Actor(world as any, { name: "label" });
  const definition = new TextDefinition();
  const component = definition.create(actor, definition.parse(data), {
    mode: "edit",
    assets: new ComponentAssets(definition.assets, { font: kFontReference }, {
      resolve: <TValue>(): TValue | null => font as TValue | null
    })
  });

  return { definition, component };
}

describe("Components.TextDefinition", () => {
  test("keeps a text component whose font is not available yet", () => {
    const { component } = createText({ text: "A" }, null);

    assert.equal(component.font, null);
    assert.equal(component.settings.text, "A");
  });

  test("captures a live text as the data it was built from", () => {
    const data = {
      text: "A",
      size: 2,
      bevel: true,
      align: "right",
      material: { color: "#00ff00", emissive: "#112233" },
      castShadow: true
    };
    const { definition, component } = createText(data, blockFont());

    assert.deepEqual(
      definition.parse(definition.capture(component)),
      definition.parse(data)
    );
  });

  test("parses an unknown alignment to centered text", () => {
    assert.equal(
      new TextDefinition().parse({ align: "justify" }).align,
      "center"
    );
  });
});
