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
import { Window } from "happy-dom";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type {
  ViewHelperHost
} from "../../../src/ui/viewHelper/mountViewHelper.ts";

// CONSTANTS
const kBrowserWindow = new Window();

type DrawHandler = Systems.RendererEvents["draw"];
type ViewHelperModule = typeof import(
  "../../../src/ui/viewHelper/mountViewHelper.ts"
);

let mountViewHelper: ViewHelperModule["mountViewHelper"];
let findViewHelperCamera: ViewHelperModule["findViewHelperCamera"];
let resolveViewHelperLocation: ViewHelperModule["resolveViewHelperLocation"];

before(async() => {
  installBrowserGlobals();

  ({
    mountViewHelper,
    findViewHelperCamera,
    resolveViewHelperLocation
  } = await import("../../../src/ui/viewHelper/mountViewHelper.ts"));
});

describe("findViewHelperCamera", () => {
  test("returns null without render components", () => {
    assert.equal(findViewHelperCamera([]), null);
  });

  test("returns the camera of the lowest-depth component", () => {
    const overlay = createRenderComponent(10);
    const main = createRenderComponent(-1);
    const secondary = createRenderComponent(0);

    assert.equal(
      findViewHelperCamera([overlay, main, secondary]),
      main.threeCamera
    );
  });

  test("keeps the first component when depths are equal", () => {
    const first = createRenderComponent(0);
    const second = createRenderComponent(0);

    assert.equal(
      findViewHelperCamera([first, second]),
      first.threeCamera
    );
  });
});

describe("resolveViewHelperLocation", () => {
  test("anchors each corner with the inset", () => {
    assert.deepEqual(resolveViewHelperLocation("top-left", 4), {
      top: 4,
      bottom: 0,
      left: 4,
      right: 0
    });
    assert.deepEqual(resolveViewHelperLocation("top-right", 4), {
      top: 4,
      bottom: 0,
      left: null,
      right: 4
    });
    assert.deepEqual(resolveViewHelperLocation("bottom-left", 4), {
      top: null,
      bottom: 4,
      left: 4,
      right: 0
    });
    assert.deepEqual(resolveViewHelperLocation("bottom-right", 4), {
      top: null,
      bottom: 4,
      left: null,
      right: 4
    });
  });
});

describe("mountViewHelper", () => {
  test("renders nothing while no camera is registered", () => {
    const renderer = new FakeRenderer();
    const mounted = mountViewHelper(renderer);

    renderer.draw();
    mounted.dispose();

    assert.equal(renderer.source.renders.length, 0);
  });

  test("renders a helper bound to the lowest-depth camera", () => {
    const renderer = new FakeRenderer();
    const main = createRenderComponent(0);
    renderer.renderComponents.push(createRenderComponent(5), main);
    const mounted = mountViewHelper(renderer);

    renderer.draw();
    mounted.dispose();

    assert.equal(renderer.source.renders.length, 1);
    assert.equal(renderer.source.renders[0].camera, main.threeCamera);
  });

  test("applies the position and inset to the helper location", () => {
    const renderer = new FakeRenderer();
    renderer.renderComponents.push(createRenderComponent(0));
    const mounted = mountViewHelper(renderer, {
      position: "top-left",
      inset: 12
    });

    renderer.draw();
    mounted.dispose();

    assert.deepEqual(renderer.source.renders[0].location, {
      top: 12,
      bottom: 0,
      left: 12,
      right: 0
    });
  });

  test("rebinds to a new lowest-depth camera", () => {
    const renderer = new FakeRenderer();
    renderer.renderComponents.push(createRenderComponent(0));
    const mounted = mountViewHelper(renderer);

    renderer.draw();
    const replacement = createRenderComponent(-1);
    renderer.renderComponents.push(replacement);
    renderer.draw();
    mounted.dispose();

    const [first, second] = renderer.source.renders;
    assert.notEqual(first, second);
    assert.equal(second.camera, replacement.threeCamera);
  });

  test("stops rendering once disposed", () => {
    const renderer = new FakeRenderer();
    renderer.renderComponents.push(createRenderComponent(0));
    const mounted = mountViewHelper(renderer);

    mounted.dispose();
    renderer.draw();

    assert.equal(renderer.source.renders.length, 0);
    assert.equal(renderer.handlers.size, 0);
  });
});

interface RenderedHelper {
  camera: THREE.Camera;
  location: unknown;
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

function installBrowserGlobals(): void {
  Object.defineProperty(
    kBrowserWindow.HTMLCanvasElement.prototype,
    "getContext",
    {
      configurable: true,
      value: createContext2DStub
    }
  );
  Object.defineProperties(globalThis, {
    window: {
      configurable: true,
      value: kBrowserWindow
    },
    document: {
      configurable: true,
      value: kBrowserWindow.document
    }
  });
}
