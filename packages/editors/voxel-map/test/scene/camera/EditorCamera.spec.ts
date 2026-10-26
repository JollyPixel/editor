// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  beforeEach,
  describe,
  mock,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import type * as THREE_WEBGPU from "three/webgpu";
import { KeyBindings } from "@jolly-pixel/controls";
import { LogQueue } from "@jolly-pixel/ui";
import { VoxelTransparencyPassNode } from "@jolly-pixel/voxel.renderer";
import type {
  CameraPose,
  Systems
} from "@jolly-pixel/engine";
import { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { EditorCamera } from "../../../src/scene/camera/EditorCamera.ts";
import type { BoundedLayer } from "../../../src/scene/camera/layerBounds.ts";
import { PointerCapture } from "../../../src/state/PointerCapture.ts";

function createLayer(
  min: THREE.Vector3Like,
  max: THREE.Vector3Like
): BoundedLayer {
  return {
    visible: true,
    worldBounds: () => new THREE.Box3(
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(max.x, max.y, max.z)
    )
  };
}

function setup(
  samples?: number
) {
  const keyboard = new KeyBindings();
  const pointer = new PointerCapture();
  const log = new LogQueue();
  const poses: CameraPose[] = [];
  const framed: THREE.Vector3[] = [];
  const pivots: THREE.Vector3Like[] = [];
  const controls = {
    camera: new THREE.PerspectiveCamera(60, 1, 0.1, 1000),
    enabled: true,
    isOrbiting: false,
    postProcessing: null as Systems.PostProcessing | null,
    teleport: (pose: CameraPose) => poses.push(pose),
    frame: (bounds: THREE.Box3) => {
      controls.exitOrbitFocus();
      framed.push(bounds.getCenter(new THREE.Vector3()));
    },
    enterOrbitFocus: (point: THREE.Vector3Like) => {
      pivots.push(point);
      controls.isOrbiting = true;
    },
    exitOrbitFocus: () => {
      controls.isOrbiting = false;
    }
  };
  const world = {
    input: { keyboard },
    createActor: () => {
      return {
        addComponentAndGet: () => controls
      };
    }
  } as unknown as Systems.World;

  const camera = new EditorCamera({
    world,
    pointer,
    log,
    samples,
    preferences: new Preferences()
  });

  function pressEscape(): boolean {
    return keyboard.dispatch(
      new KeyboardEvent("keydown", {
        code: "Escape",
        key: "Escape",
        cancelable: true
      })
    );
  }

  function messages(): string[] {
    return log.entries.map((entry) => String(entry.content)).reverse();
  }

  return {
    camera,
    controls,
    pointer,
    messages,
    pivots,
    poses,
    framed,
    pressEscape
  };
}

function createBlock(
  position: THREE.Vector3Like
): THREE.Object3D {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  mesh.position.set(
    position.x + 0.5,
    position.y + 0.5,
    position.z + 0.5
  );

  const root = new THREE.Group();
  root.add(mesh);
  root.updateMatrixWorld(true);

  return root;
}

function passSamples(
  samples?: number
): number | undefined {
  const { camera, controls } = setup(samples);
  camera.glow = false;
  const node = controls.postProcessing?.({
    renderer: {} as THREE_WEBGPU.WebGPURenderer,
    scene: new THREE.Scene(),
    camera: camera.camera
  });
  assert.ok(node instanceof VoxelTransparencyPassNode);

  return node.options.samples;
}

describe("EditorCamera", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  test("frames the layers once per spawn request", () => {
    const { camera, framed } = setup();
    const near = [createLayer({ x: 0, y: 0, z: 0 }, { x: 4, y: 4, z: 4 })];
    const far = [createLayer({ x: 20, y: 0, z: 0 }, { x: 24, y: 4, z: 4 })];

    camera.spawn(near);
    camera.spawn(far);
    camera.requestSpawn();
    camera.spawn(far);

    assert.deepEqual(
      framed.slice(1).map((center) => center.x),
      [2, 22]
    );
  });

  test("announces a mode switch only when the orbit state changes", () => {
    const { camera, messages, pressEscape } = setup();

    camera.focus({ x: 1, y: 0, z: 1 });
    camera.focus({ x: 2, y: 0, z: 2 });
    assert.equal(pressEscape(), true);
    camera.exitFocus();

    assert.deepEqual(messages(), [
      "Camera switched to pivot",
      "Camera switched to free fly"
    ]);
  });

  test("spawning releases the orbit focus", () => {
    const { camera, controls, messages } = setup();

    camera.focus({ x: 1, y: 0, z: 1 });
    camera.spawn([]);

    assert.equal(controls.isOrbiting, false);
    assert.equal(messages().at(-1), "Camera switched to free fly");
  });

  test("disables the controls while the pointer is captured", () => {
    const { controls, pointer } = setup();
    const owner = {};

    pointer.capture(owner);
    assert.equal(controls.enabled, false);

    pointer.release(owner);
    assert.equal(controls.enabled, true);
  });

  test("passes Escape on while the camera flies freely", () => {
    const { camera, messages, pressEscape } = setup();

    assert.equal(pressEscape(), false);

    camera.focus({ x: 1, y: 0, z: 1 });
    assert.equal(pressEscape(), true);
    assert.equal(pressEscape(), false);
    assert.equal(messages().at(-1), "Camera switched to free fly");
  });

  test("pivots around the center of the voxel under the pointer", () => {
    const { camera, controls, pivots } = setup();
    controls.camera.position.set(3.5, 10, 4.5);
    controls.camera.lookAt(3.5, 0, 4.5);
    controls.camera.updateMatrixWorld(true);

    camera.pivotAt(
      createBlock({ x: 3, y: 0, z: 4 }),
      new THREE.Vector2(0, 0)
    );

    assert.equal(controls.isOrbiting, true);
    assert.deepEqual(pivots, [{ x: 3.5, y: 0.5, z: 4.5 }]);
  });

  test("dispose releases the Escape binding and the pointer watch", () => {
    const { camera, controls, pointer, pressEscape } = setup();

    camera.focus({ x: 1, y: 0, z: 1 });
    camera.dispose();
    pointer.capture({});

    assert.equal(pressEscape(), false);
    assert.equal(controls.enabled, true);
  });

  test("multisamples the scene pass 4x by default, since the canvas has no MSAA", () => {
    assert.equal(passSamples(), 4);
    assert.equal(passSamples(0), 0);
  });

  test("keeps the camera pipeline while the glow setting is unchanged", () => {
    const { camera, controls } = setup();

    camera.glow = true;
    const glowing = controls.postProcessing;
    camera.glow = true;

    assert.equal(camera.glow, true);
    assert.equal(controls.postProcessing, glowing);

    camera.glow = false;

    assert.equal(camera.glow, false);
    assert.notEqual(controls.postProcessing, glowing);
  });
});
