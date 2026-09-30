// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { ViewportRenderer } from "#src/scene/ViewportRenderer.ts";

function createCamera(
  placed: string[]
): Systems.RenderComponent {
  return {
    threeCamera: new THREE.PerspectiveCamera(),
    depth: 3,
    viewport: null,
    prepareRender: () => {
      placed.push("camera");
    }
  };
}

function createRenderer(
  components: Systems.RenderComponent[]
) {
  return {
    renderComponents: components,
    addRenderComponent: (component: Systems.RenderComponent) => {
      components.push(component);
    },
    removeRenderComponent: (component: Systems.RenderComponent) => {
      components.splice(components.indexOf(component), 1);
    }
  };
}

describe("ViewportRenderer", () => {
  test("takes the camera's place and places it before the pre-draw steps", () => {
    const placed: string[] = [];
    const camera = createCamera(placed);
    const components = [camera];
    const viewport = new ViewportRenderer(camera);
    viewport.addPreDrawStep(() => placed.push("outlines"));

    viewport.replaceCamera(createRenderer(components));
    viewport.prepareRender(800, 600);

    assert.deepEqual(components, [viewport]);
    assert.equal(viewport.depth, 3);
    assert.deepEqual(placed, ["camera", "outlines"]);
  });

  test("refuses to replace a camera that does not render yet", () => {
    const camera = createCamera([]);
    const viewport = new ViewportRenderer(camera);
    const components: Systems.RenderComponent[] = [];

    assert.throws(() => viewport.replaceCamera(createRenderer(components)));
    assert.deepEqual(components, []);
  });
});
