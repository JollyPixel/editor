// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  DirectRenderStrategy
} from "../../../src/systems/rendering/RenderStrategy.ts";
import type { RenderComponent } from "../../../src/systems/rendering/Renderer.ts";
import {
  createRenderComponent,
  createRendererSpy
} from "./helpers.ts";

describe("Systems.Rendering.DirectRenderStrategy", () => {
  const scene = new THREE.Scene();

  function render(
    components: RenderComponent[]
  ) {
    const renderer = createRendererSpy();
    const strategy = new DirectRenderStrategy(renderer as any);

    strategy.render(scene, {
      components,
      canvasWidth: 800,
      canvasHeight: 600
    });

    return renderer;
  }

  test("should render the components in the order it receives them", () => {
    const first = createRenderComponent();
    const second = createRenderComponent();

    const renderer = render([second, first]);

    assert.deepStrictEqual(
      renderer.render.mock.calls.map((call) => call.arguments[1]),
      [second.threeCamera, first.threeCamera],
      "sorting belongs to ThreeRenderer — the strategy must not re-sort"
    );
  });

  test("should prepare every component with the canvas size", () => {
    const component = createRenderComponent();

    render([component]);

    assert.strictEqual(component.prepareRender.mock.callCount(), 1);
    assert.deepStrictEqual(
      component.prepareRender.mock.calls[0].arguments,
      [800, 600]
    );
  });

  test("should clear once for the whole frame when no camera has a viewport", () => {
    const renderer = render([createRenderComponent(), createRenderComponent()]);

    assert.strictEqual(renderer.clear.mock.callCount(), 1);
    assert.strictEqual(renderer.setScissorTest.mock.callCount(), 0);
  });

  test("should scissor and clear per camera as soon as one has a viewport", () => {
    const renderer = render([
      createRenderComponent({
        viewport: { x: 0, y: 0, width: 0.5, height: 1 }
      }),
      createRenderComponent()
    ]);

    assert.strictEqual(renderer.clear.mock.callCount(), 2);
    assert.deepStrictEqual(
      renderer.setScissor.mock.calls[0].arguments,
      [0, 0, 400, 600]
    );
    assert.deepStrictEqual(
      renderer.setViewport.mock.calls.at(-1)!.arguments,
      [0, 0, 800, 600],
      "the full canvas viewport must be restored at the end of the frame"
    );
  });

  test("should give a camera without a viewport the full canvas", () => {
    const renderer = render([
      createRenderComponent({ viewport: { x: 0.5, y: 0, width: 0.5, height: 1 } }),
      createRenderComponent()
    ]);

    assert.deepStrictEqual(
      renderer.setScissor.mock.calls[1].arguments,
      [0, 0, 800, 600]
    );
  });

  test("should resize the canvas without touching its CSS size", () => {
    const renderer = createRendererSpy();

    new DirectRenderStrategy(renderer as any).resize(1024, 768);

    assert.deepStrictEqual(
      renderer.setSize.mock.calls[0].arguments,
      [1024, 768, false]
    );
  });

  test("should not dispose the renderer it borrows", () => {
    const renderer = createRendererSpy();

    new DirectRenderStrategy(renderer as any).dispose();

    assert.strictEqual(renderer.dispose.mock.callCount(), 0);
  });
});
