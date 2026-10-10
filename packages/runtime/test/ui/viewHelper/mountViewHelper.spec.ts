// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  before,
  describe,
  mock,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  mountViewHelper,
  type ViewHelperHost
} from "../../../src/ui/viewHelper/mountViewHelper.ts";
import {
  ViewHelperSettings,
  type ViewHelperOptions,
  type ViewHelperPosition
} from "../../../src/ui/viewHelper/ViewHelperSettings.ts";

// CONSTANTS
const kLocations: Array<[ViewHelperPosition, HelperLocation]> = [
  [
    "top-left",
    {
      top: 12,
      bottom: 0,
      left: 12,
      right: 0
    }
  ],
  [
    "top-right",
    {
      top: 12,
      bottom: 0,
      left: null,
      right: 12
    }
  ],
  [
    "bottom-left",
    {
      top: null,
      bottom: 12,
      left: 12,
      right: 0
    }
  ],
  [
    "bottom-right",
    {
      top: null,
      bottom: 12,
      left: null,
      right: 12
    }
  ]
];

type DrawHandler = Systems.RendererEvents["draw"];

interface HelperLocation {
  top: number | null;
  bottom: number | null;
  left: number | null;
  right: number | null;
}

before(() => {
  Object.defineProperty(
    HTMLCanvasElement.prototype,
    "getContext",
    {
      configurable: true,
      value: createContext2DStub
    }
  );
});

describe("mountViewHelper", () => {
  test("renders nothing while no camera is registered", () => {
    const renderer = new FakeRenderer();
    const mounted = mountViewHelper(renderer, createSettings());

    renderer.draw();
    mounted.dispose();

    assert.equal(renderer.source.renders.length, 0);
  });

  test("renders a helper bound to the lowest-depth camera", () => {
    const renderer = new FakeRenderer();
    const main = createRenderComponent(0);
    renderer.renderComponents.push(createRenderComponent(5), main);
    const mounted = mountViewHelper(renderer, createSettings());

    renderer.draw();
    mounted.dispose();

    assert.equal(renderer.source.renders.length, 1);
    assert.equal(renderer.source.renders[0].camera, main.threeCamera);
  });

  test("binds the first of equally deep cameras", () => {
    const renderer = new FakeRenderer();
    const first = createRenderComponent(0);
    renderer.renderComponents.push(first, createRenderComponent(0));
    const mounted = mountViewHelper(renderer, createSettings());

    renderer.draw();
    mounted.dispose();

    assert.equal(renderer.source.renders[0].camera, first.threeCamera);
  });

  for (const [position, location] of kLocations) {
    test(`anchors a ${position} helper with the inset`, () => {
      const renderer = new FakeRenderer();
      renderer.renderComponents.push(createRenderComponent(0));
      const mounted = mountViewHelper(renderer, createSettings({
        position,
        inset: 12
      }));

      renderer.draw();
      mounted.dispose();

      assert.deepEqual(renderer.source.renders[0].location, location);
    });
  }

  test("rebinds to a new lowest-depth camera", () => {
    const renderer = new FakeRenderer();
    renderer.renderComponents.push(createRenderComponent(0));
    const mounted = mountViewHelper(renderer, createSettings());

    renderer.draw();
    const replacement = createRenderComponent(-1);
    renderer.renderComponents.push(replacement);
    renderer.draw();
    mounted.dispose();

    const [first, second] = renderer.source.renders;
    assert.notEqual(first, second);
    assert.equal(second.camera, replacement.threeCamera);
  });

  test("skips drawing while hidden and requests a frame on each change", () => {
    const renderer = new FakeRenderer();
    renderer.renderComponents.push(createRenderComponent(0));
    let invalidations = 0;
    const settings = createSettings({}, () => {
      invalidations++;
    });
    const mounted = mountViewHelper(renderer, settings);

    settings.hidden = true;
    settings.hidden = true;
    renderer.draw();
    assert.equal(renderer.source.renders.length, 0);

    settings.hidden = false;
    renderer.draw();
    mounted.dispose();

    assert.equal(renderer.source.renders.length, 1);
    assert.equal(invalidations, 2);
  });

  test("stops rendering once disposed", () => {
    const renderer = new FakeRenderer();
    renderer.renderComponents.push(createRenderComponent(0));
    const mounted = mountViewHelper(renderer, createSettings());

    mounted.dispose();
    renderer.draw();

    assert.equal(renderer.source.renders.length, 0);
    assert.equal(renderer.handlers.size, 0);
  });
});

interface RenderedHelper {
  camera: THREE.Camera;
  location: HelperLocation;
}

class FakeSource {
  readonly isWebGPURenderer = true;
  readonly renders: RenderedHelper[] = [];

  readonly clearDepth = mock.fn();
  readonly setViewport = mock.fn();

  getViewport(
    target: THREE.Vector4
  ): THREE.Vector4 {
    return target.set(0, 0, 100, 100);
  }

  render(
    scene: RenderedHelper
  ): void {
    this.renders.push(scene);
  }
}

class FakeRenderer implements ViewHelperHost {
  readonly canvas = document.createElement("canvas");
  readonly renderComponents: Systems.RenderComponent[] = [];
  readonly handlers = new Set<DrawHandler>();
  readonly source = new FakeSource();

  on(
    _type: "draw",
    handler: DrawHandler
  ): this {
    this.handlers.add(handler);

    return this;
  }

  off<Key extends keyof Systems.RendererEvents>(
    _type: Key,
    handler: Systems.RendererEvents[Key]
  ): void {
    this.handlers.delete(handler as DrawHandler);
  }

  draw(): void {
    for (const handler of this.handlers) {
      handler({
        source: this.source as unknown as THREE.WebGPURenderer
      });
    }
  }
}

function createSettings(
  options: ViewHelperOptions = {},
  invalidate: () => void = () => undefined
): ViewHelperSettings {
  return new ViewHelperSettings(options, invalidate);
}

function createRenderComponent(
  depth: number
): Systems.RenderComponent {
  return {
    threeCamera: new THREE.PerspectiveCamera(),
    depth,
    viewport: null,
    prepareRender: mock.fn()
  };
}

function createContext2DStub(): unknown {
  return new Proxy({}, {
    get: () => () => undefined,
    set: () => true
  });
}
