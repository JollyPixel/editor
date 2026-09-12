// Import Node.js Dependencies
import assert from "node:assert/strict";
import { it } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Systems } from "@jolly-pixel/engine";
import { VoxelTransparencyRenderer } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { installTransparency } from "../../src/scene/installTransparency.ts";

it("installs camera compositing and restores the previous strategy", (context) => {
  const source = new THREE.WebGPURenderer();
  const resize = context.mock.fn();
  const previous = {
    render: context.mock.fn(),
    resize,
    dispose: context.mock.fn()
  };
  /*
   * Only the public renderer adapter is needed; GPU drawing is covered by
   * voxel-renderer's framebuffer tests.
   */
  const renderer: Systems.ThreeRenderer = Object.assign(
    Object.create(Systems.ThreeRenderer.prototype),
    { webGPURenderer: source, renderStrategy: previous }
  );
  const render = context.mock.method(VoxelTransparencyRenderer.prototype, "render", () => void 0);
  const dispose = context.mock.method(VoxelTransparencyRenderer.prototype, "dispose", () => void 0);
  const release = installTransparency(renderer);
  const strategy = renderer.renderStrategy;
  assert.notEqual(strategy, previous);
  const camera = new THREE.PerspectiveCamera();
  const prepare = context.mock.fn();
  const scene = new THREE.Scene();
  strategy.render(scene, {
    canvasWidth: 800,
    canvasHeight: 600,
    components: [{
      threeCamera: camera,
      depth: 0,
      viewport: { x: 0.5, y: 0, width: 0.5, height: 1 },
      prepareRender: prepare
    }]
  });
  assert.deepEqual(prepare.mock.calls[0].arguments, [800, 600]);
  assert.deepEqual(source.getViewport(new THREE.Vector4()).toArray(), [400, 0, 400, 600]);
  assert.deepEqual(render.mock.calls[0].arguments, [scene, camera]);
  strategy.resize(1024, 768);
  assert.deepEqual(resize.mock.calls[0].arguments, [1024, 768]);
  release();
  assert.equal(renderer.renderStrategy, previous);
  assert.equal(dispose.mock.callCount(), 1);
  assert.equal(previous.dispose.mock.callCount(), 0);

  const releaseSecond = installTransparency(renderer);
  const replacement = { ...previous };
  renderer.renderStrategy = replacement;
  releaseSecond();
  assert.equal(renderer.renderStrategy, replacement);
  assert.equal(dispose.mock.callCount(), 2);
});
