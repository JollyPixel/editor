// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/index.ts";
import {
  TextRenderer,
  type TextRendererOptions
} from "../../../src/components/renderers/text/TextRenderer.ts";
import { SceneManager } from "../../../src/systems/scene/SceneManager.ts";
import { blockFont } from "../../helpers/text/blockFont.ts";

function createText(
  options: TextRendererOptions = {}
) {
  const world = { sceneManager: new SceneManager() };
  const actor = new Actor(world as any, { name: "label" });

  return actor.addComponentAndGet(TextRenderer, options);
}

function bounds(
  renderer: TextRenderer<unknown>
): THREE.Box3 {
  return new THREE.Box3().setFromBufferAttribute(
    renderer.threeMesh.geometry.getAttribute("position") as THREE.BufferAttribute
  );
}

describe("Components.Renderers.TextRenderer", () => {
  test("draws nothing until it has a font", () => {
    const renderer = createText({ text: "AA" });
    assert.equal(renderer.threeMesh.geometry.getAttribute("position"), undefined);

    renderer.font = blockFont();

    assert.ok(renderer.threeMesh.geometry.getAttribute("position").count > 0);
  });

  test("extrudes its depth centered on the actor plane", () => {
    const box = bounds(createText({
      font: blockFont(),
      text: "A",
      depth: 0.4
    }));

    assert.ok(Math.abs(box.min.z + 0.2) < 1e-6);
    assert.ok(Math.abs(box.max.z - 0.2) < 1e-6);
  });

  for (const [align, edge] of [
    ["left", "min"],
    ["right", "max"]
  ] as const) {
    test(`puts the ${align} edge of the text on the actor origin`, () => {
      const box = bounds(createText({
        font: blockFont(),
        text: "AA",
        align
      }));

      assert.ok(Math.abs(box[edge].x) < 1e-6);
    });
  }

  test("centers the text on the actor origin by default", () => {
    const box = bounds(createText({ font: blockFont(), text: "AA" }));

    assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6);
  });

  test("keeps the geometry when only the material changes", () => {
    const renderer = createText({ font: blockFont(), text: "A" });
    const geometry = renderer.threeMesh.geometry;

    renderer.configure({ material: { color: "#ff0000" } });

    assert.equal(renderer.threeMesh.geometry, geometry);
    assert.equal(renderer.threeMesh.material.color.getHexString(), "ff0000");
  });
});
