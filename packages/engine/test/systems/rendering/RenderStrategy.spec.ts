// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  DirectRenderStrategy
} from "../../../src/systems/rendering/RenderStrategy.ts";
import type { RenderComponent } from "../../../src/systems/rendering/Renderer.ts";
import type {
  PostProcessingContext
} from "../../../src/systems/rendering/PostProcessing.ts";
import {
  createPipelineSpy,
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

describe("Systems.Rendering.DirectRenderStrategy post-processing", () => {
  const scene = new THREE.Scene();

  function setup(
    onPipelineRender?: () => void
  ) {
    const renderer = createRendererSpy();
    const pipelines: ReturnType<typeof createPipelineSpy>[] = [];
    const createPipeline = mock.fn((
      _renderer: THREE.WebGPURenderer,
      outputNode: THREE.Node
    ) => {
      const pipeline = createPipelineSpy(outputNode, onPipelineRender);
      pipelines.push(pipeline);

      return pipeline;
    });
    const strategy = new DirectRenderStrategy(
      renderer as any,
      createPipeline
    );

    function render(
      components: RenderComponent[]
    ) {
      strategy.render(scene, {
        components,
        canvasWidth: 800,
        canvasHeight: 600
      });
    }

    return {
      renderer,
      strategy,
      pipelines,
      createPipeline,
      render
    };
  }

  test("should render a post-processed camera through its pipeline", () => {
    const { renderer, pipelines, render } = setup();
    const outputNode = new THREE.Node();
    const postProcessing = mock.fn((_context: PostProcessingContext) => outputNode);
    const component = createRenderComponent({ postProcessing });

    render([component]);

    assert.strictEqual(renderer.render.mock.callCount(), 0);
    assert.strictEqual(pipelines.length, 1);
    assert.strictEqual(pipelines[0].outputNode, outputNode);
    assert.strictEqual(pipelines[0].render.mock.callCount(), 1);

    const [context] = postProcessing.mock.calls[0].arguments;
    assert.strictEqual(context.renderer, renderer);
    assert.strictEqual(context.scene, scene);
    assert.strictEqual(context.camera, component.threeCamera);
  });

  test("should render cameras without post-processing directly", () => {
    const { renderer, pipelines, render } = setup();
    const direct = createRenderComponent();

    render([
      createRenderComponent({ postProcessing: () => new THREE.Node() }),
      direct
    ]);

    assert.strictEqual(pipelines[0].render.mock.callCount(), 1);
    assert.deepStrictEqual(
      renderer.render.mock.calls.map((call) => call.arguments[1]),
      [direct.threeCamera]
    );
  });

  test("should set the camera viewport before the pipeline draws", () => {
    let viewportAtDraw: unknown[] | undefined;
    const { renderer, render } = setup(() => {
      viewportAtDraw = renderer.setViewport.mock.calls.at(-1)!.arguments;
    });

    render([
      createRenderComponent({
        viewport: { x: 0.5, y: 0, width: 0.5, height: 1 },
        postProcessing: () => new THREE.Node()
      })
    ]);

    assert.deepStrictEqual(viewportAtDraw, [400, 0, 400, 600]);
  });

  test("should reuse the pipeline across frames", () => {
    const { pipelines, createPipeline, render } = setup();
    const component = createRenderComponent({
      postProcessing: () => new THREE.Node()
    });

    render([component]);
    render([component]);

    assert.strictEqual(createPipeline.mock.callCount(), 1);
    assert.strictEqual(pipelines[0].render.mock.callCount(), 2);
  });

  test("should rebuild the pipeline when the post-processing changes", () => {
    const { pipelines, render } = setup();
    const component = createRenderComponent({
      postProcessing: () => new THREE.Node()
    });

    render([component]);
    component.postProcessing = () => new THREE.Node();
    render([component]);

    assert.strictEqual(pipelines.length, 2);
    assert.strictEqual(pipelines[0].dispose.mock.callCount(), 1);
    assert.strictEqual(pipelines[1].render.mock.callCount(), 1);
  });

  test("should rebuild the pipeline when the three.js camera changes", () => {
    const { pipelines, render } = setup();
    const component = createRenderComponent({
      postProcessing: () => new THREE.Node()
    });

    render([component]);
    component.threeCamera = new THREE.OrthographicCamera();
    render([component]);

    assert.strictEqual(pipelines.length, 2);
    assert.strictEqual(pipelines[0].dispose.mock.callCount(), 1);
  });

  test("should fall back to a direct render once post-processing is cleared", () => {
    const { renderer, pipelines, render } = setup();
    const component = createRenderComponent({
      postProcessing: () => new THREE.Node()
    });

    render([component]);
    component.postProcessing = null;
    render([component]);

    assert.strictEqual(pipelines[0].dispose.mock.callCount(), 1);
    assert.strictEqual(renderer.render.mock.callCount(), 1);
  });

  test("should dispose the pipeline of a removed camera", () => {
    const { pipelines, render } = setup();
    const component = createRenderComponent({
      postProcessing: () => new THREE.Node()
    });

    render([component]);
    render([]);

    assert.strictEqual(pipelines[0].dispose.mock.callCount(), 1);
  });

  test("should dispose every pipeline with the strategy", () => {
    const { strategy, pipelines, render } = setup();

    render([
      createRenderComponent({ postProcessing: () => new THREE.Node() }),
      createRenderComponent({ postProcessing: () => new THREE.Node() })
    ]);
    strategy.dispose();

    assert.deepStrictEqual(
      pipelines.map((pipeline) => pipeline.dispose.mock.callCount()),
      [1, 1]
    );
  });
});
