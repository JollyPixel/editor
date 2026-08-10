// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Pane } from "tweakpane";

// Import Internal Dependencies
import { PeerFrustum, type PeerFrustumOptions } from "../../src/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/pane.ts";

// CONSTANTS
// Kept far enough apart that near < depth always holds, regardless of the
// two sliders' independent values, so no cross-field validation is needed.
const kNearRange = { min: 0.05, max: 1, step: 0.05 };
const kDepthRange = { min: 1.2, max: 4, step: 0.1 };
const kFovRange = { min: 20, max: 120, step: 1 };
const kAspectRange = { min: 0.5, max: 3, step: 0.05 };

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = await createRenderer(canvas);

const scene = createScene("#1e2a30");
scene.add(new THREE.AxesHelper(1));
scene.add(new THREE.GridHelper(20, 20, "#3a4750", "#2a3439"));

const { camera, controls } = createOrbitCamera(
  canvas,
  { x: 6, y: 5, z: 8 },
  { x: 0, y: 1, z: 0 }
);

const pane = createExamplePane();

// A handful of peers at different poses/colors, purely to eyeball the
// frustum shape from multiple angles at once. This is not wired to real presence
// data (see the "Peer Frustum Sync" example / examples/scripts/network/
// PeerFrustumSync.ts to sync real peers over a network.Room).
spawnPeer(scene, pane, {
  position: new THREE.Vector3(0, 1, 0),
  lookAt: new THREE.Vector3(3, 1, 3),
  color: "#f94144",
  name: "Default"
});
spawnPeer(scene, pane, {
  position: new THREE.Vector3(-3, 2, 1),
  lookAt: new THREE.Vector3(0, 0, 0),
  color: "#43aa8b",
  name: "BoxName",
  showNameBox: true
});
spawnPeer(scene, pane, {
  position: new THREE.Vector3(2, 0.5, -2),
  lookAt: new THREE.Vector3(0, 1, 0),
  color: "#577590",
  name: "Apex",
  showApex: true
});

startLoop({
  renderer,
  scene,
  camera,
  controls
});

interface PeerSpawnOptions {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  color: THREE.ColorRepresentation;
  name: string;
  showApex?: boolean;
  showNameBox?: boolean;
}

/**
 * Spawns a peer frustum and wires a Tweakpane folder exposing every
 * `PeerFrustumOptions` field. `color`/`name`/`showNameBox` update the live
 * instance via its setters; `fov`/`aspect`/`near`/`depth`/`showApex` are
 * constructor-only, so changing them replaces the instance instead.
 */
function spawnPeer(
  scene: THREE.Scene,
  pane: Pane,
  spawn: PeerSpawnOptions
): void {
  const state = {
    color: spawn.color,
    name: spawn.name,
    showNameBox: spawn.showNameBox ?? false,
    showApex: spawn.showApex ?? false,
    fov: 50,
    aspect: 16 / 9,
    near: 0.3,
    depth: 1.5
  };

  let frustum = buildFrustum(state);
  frustum.position.copy(spawn.position);
  frustum.lookAt(spawn.lookAt);
  frustum.rotateY(Math.PI);
  scene.add(frustum);

  function rebuild(): void {
    scene.remove(frustum);
    frustum.dispose();

    frustum = buildFrustum(state);
    frustum.position.copy(spawn.position);
    frustum.lookAt(spawn.lookAt);
    frustum.rotateY(Math.PI);
    scene.add(frustum);
  }

  const folder = pane.addFolder({ title: spawn.name });

  folder.addBinding(state, "color")
    .on("change", ({ value }) => frustum.setColor(value));
  folder.addBinding(state, "name")
    .on("change", ({ value }) => frustum.setName(value));
  folder.addBinding(state, "showNameBox")
    .on("change", ({ value }) => frustum.setShowNameBox(value));

  folder.addBlade({ view: "separator" });
  folder.addBinding(state, "showApex").on("change", rebuild);
  folder.addBinding(state, "fov", kFovRange).on("change", rebuild);
  folder.addBinding(state, "aspect", kAspectRange).on("change", rebuild);
  folder.addBinding(state, "near", kNearRange).on("change", rebuild);
  folder.addBinding(state, "depth", kDepthRange).on("change", rebuild);
}

function buildFrustum(
  options: Required<Pick<
    PeerFrustumOptions,
    "color" | "name" | "showNameBox" | "showApex" | "fov" | "aspect" | "near" | "depth"
  >>
): PeerFrustum {
  return new PeerFrustum(options);
}
