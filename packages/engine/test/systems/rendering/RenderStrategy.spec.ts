// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

// Import Internal Dependencies
import {
  DirectRenderStrategy,
  ComposerRenderStrategy,
  orderRenderPasses
} from "../../../src/systems/rendering/RenderStrategy.ts";
import type { RenderComponent } from "../../../src/systems/rendering/Renderer.ts";
import {
  createRenderComponent,
  createRenderPassStub,
  createWebGLRendererSpy
} from "./helpers.ts";

describe("Systems.Rendering.orderRenderPasses", () => {
  test("should follow the component order it is given", () => {
    const [first, second] = [createRenderComponent(), createRenderComponent()];
    const passes = new Map([
      [first, createRenderPassStub()],
      [second, createRenderPassStub()]
    ]);

    const ordered = orderRenderPasses([second, first], passes as any);

    assert.deepStrictEqual(ordered, [passes.get(second), passes.get(first)]);
  });

  test("should only let the first pass clear the color buffer", () => {
    const components = [
      createRenderComponent(),
      createRenderComponent(),
      createRenderComponent()
    ];
    const passes = new Map(
      components.map((component) => [component, createRenderPassStub()])
    );

    orderRenderPasses(components, passes as any);

    assert.deepStrictEqual(
      components.map((component) => passes.get(component)!.clear),
      [true, false, false],
      "a clearing second pass would wipe the first camera's output"
    );
  });

  test("should clear depth on every pass but the first, so cameras layer", () => {
    const components = [createRenderComponent(), createRenderComponent()];
    const passes = new Map(
      components.map((component) => [component, createRenderPassStub()])
    );

    orderRenderPasses(components, passes as any);

    assert.deepStrictEqual(
      components.map((component) => passes.get(component)!.clearDepth),
      [false, true]
    );
  });

  test("should skip components that have no pass", () => {
    const [withPass, withoutPass] = [
      createRenderComponent(),
      createRenderComponent()
    ];
    const pass = createRenderPassStub();
    const passes = new Map([[withPass, pass]]);

    const ordered = orderRenderPasses([withoutPass, withPass], passes as any);

    assert.deepStrictEqual(ordered, [pass]);
    assert.strictEqual(pass.clear, true, "the only pass is the first one");
  });

  test("should return an empty list when nothing is registered", () => {
    assert.deepStrictEqual(orderRenderPasses([], new Map()), []);
  });
});

describe("Systems.Rendering.DirectRenderStrategy", () => {
  const scene = new THREE.Scene();

  function render(
    components: RenderComponent[]
  ) {
    const renderer = createWebGLRendererSpy();
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
    const renderer = createWebGLRendererSpy();

    new DirectRenderStrategy(renderer as any).resize(1024, 768);

    assert.deepStrictEqual(
      renderer.setSize.mock.calls[0].arguments,
      [1024, 768, false]
    );
  });

  test("should not dispose the renderer it borrows", () => {
    const renderer = createWebGLRendererSpy();

    new DirectRenderStrategy(renderer as any).dispose();

    assert.strictEqual(renderer.dispose.mock.callCount(), 0);
  });
});

describe("Systems.Rendering.ComposerRenderStrategy", () => {
  const scene = new THREE.Scene();

  function createStrategy() {
    const renderer = createWebGLRendererSpy();
    const composer = new EffectComposer(renderer as any);
    // The composer's own render loop needs a GL context; the strategy tests
    // only cover pass bookkeeping.
    mock.method(composer, "render", () => void 0);

    return {
      renderer,
      composer,
      strategy: new ComposerRenderStrategy(renderer as any, composer)
    };
  }

  test("should rebind RenderPass scenes to the active scene", () => {
    const { composer, strategy } = createStrategy();
    const pass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    strategy.addEffect(pass);

    strategy.render(scene, { components: [], canvasWidth: 1, canvasHeight: 1 });

    assert.strictEqual(pass.scene, scene);
    assert.strictEqual(composer.passes.includes(pass), true);
  });

  test("should prepare every component before rendering", () => {
    const { strategy } = createStrategy();
    const component = createRenderComponent();

    strategy.render(scene, {
      components: [component],
      canvasWidth: 640,
      canvasHeight: 480
    });

    assert.deepStrictEqual(
      component.prepareRender.mock.calls[0].arguments,
      [640, 480]
    );
  });

  test("should detach a pass without disposing it", () => {
    const { composer, strategy } = createStrategy();
    const pass = new RenderPass(scene, new THREE.PerspectiveCamera());
    const dispose = mock.method(pass, "dispose");
    strategy.addEffect(pass);

    strategy.removeEffect(pass);

    assert.strictEqual(composer.passes.includes(pass), false);
    assert.strictEqual(
      dispose.mock.callCount(),
      0,
      "reordering relies on removeEffect leaving the pass usable"
    );
  });

  test("should reorder the listed passes and keep the rest behind them", () => {
    const { composer, strategy } = createStrategy();
    const camera = new THREE.PerspectiveCamera();
    const first = new RenderPass(scene, camera);
    const second = new RenderPass(scene, camera);
    const effect = new RenderPass(scene, camera);
    strategy.addEffect(first);
    strategy.addEffect(second);
    strategy.addEffect(effect);

    strategy.setPassOrder([second, first]);

    assert.deepStrictEqual(composer.passes, [second, first, effect]);
  });

  test("should resize the canvas before the composer targets", () => {
    const { renderer, composer, strategy } = createStrategy();
    const order: string[] = [];
    renderer.setSize.mock.mockImplementation(() => order.push("renderer"));
    mock.method(composer, "setSize", () => order.push("composer"));

    strategy.resize(320, 240);

    assert.deepStrictEqual(
      order,
      ["renderer", "composer"],
      "the final pass renders into a zero viewport if the canvas is sized last"
    );
  });

  test("should dispose every pass it holds, not just the composer targets", () => {
    const { composer, strategy } = createStrategy();
    const pass = new RenderPass(scene, new THREE.PerspectiveCamera());
    const dispose = mock.method(pass, "dispose");
    strategy.addEffect(pass);

    strategy.dispose();

    assert.strictEqual(dispose.mock.callCount(), 1);
    assert.deepStrictEqual(composer.passes, []);
  });
});
