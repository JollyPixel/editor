// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Registers the declarative controls declared by the example page.
import "@jolly-pixel/ui";

// Import Internal Dependencies
import { PeerFrustum } from "../../src/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";
import { mountPerformanceStats } from "./utils/performance-stats.ts";

// CONSTANTS
const kFovRange = { min: 20, max: 120, step: 1 };
const kAspectRange = { min: 0.5, max: 3, step: 0.05 };
const kNearRange = { min: 0.05, max: 5, step: 0.05 };
const kDepthRange = { min: 0.5, max: 6, step: 0.1 };
const kSpeedRange = { min: 0.1, max: 2, step: 0.1 };
/** `near` must stay strictly below `depth`, or the constructor throws. */
const kMaxNearRatio = 0.95;

const kLookAtTarget = new THREE.Vector3(0, 1, 0);
const kRestingPosition = new THREE.Vector3(-3, 2, 3);
const kOrbitRadius = 4;
const kOrbitHeight = 2;

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

const pane = createExamplePane({
  title: "Peer Frustum"
});
const performanceStats = mountPerformanceStats(renderer);

const frustumFolder = pane.addFolder({
  title: "Frustum"
});
const labelFolder = pane.addFolder({
  title: "Label"
});
const poseFolder = pane.addFolder({
  title: "Pose"
});

// Geometry options are constructor-only; track them here so a rebuild can
// carry the ones it is not overriding.
const geometry = {
  fov: 50,
  aspect: 16 / 9,
  near: 0.3,
  depth: 1.5,
  showApex: false
};

// Orbits the frustum around the origin, the way a live peer camera would move.
const pose = {
  animate: true,
  speed: 0.5
};
const poseTimer = new THREE.Timer();
const posePosition = kRestingPosition.clone();
let orbitElapsedSeconds = 0;

let frustum: PeerFrustum;

function applyPose(): void {
  frustum.position.copy(posePosition);
  // The wireframe points along local -Z, `lookAt` aims local +Z.
  frustum.lookAt(kLookAtTarget);
  frustum.rotateY(Math.PI);
}

function updatePose(): void {
  poseTimer.update();
  if (!pose.animate) {
    return;
  }

  orbitElapsedSeconds += poseTimer.getDelta() * pose.speed;
  posePosition.set(
    Math.cos(orbitElapsedSeconds) * kOrbitRadius,
    kOrbitHeight,
    Math.sin(orbitElapsedSeconds) * kOrbitRadius
  );
  applyPose();
}

function bindFrustumControls(
  target: PeerFrustum
): void {
  frustumFolder.disposeAll();

  frustumFolder.addBinding(target, "color");
  frustumFolder.addBinding(target, "visible");

  frustumFolder.addSeparator();
  frustumFolder
    .addBinding(geometry, "fov", kFovRange)
    .on("change", ({ value, last }) => last && rebuildFrustum({ fov: value }));
  frustumFolder
    .addBinding(geometry, "aspect", kAspectRange)
    .on("change", ({ value, last }) => last && rebuildFrustum({ aspect: value }));
  frustumFolder
    .addBinding(geometry, "near", kNearRange)
    // Rebuild only on release; rebuilding mid-drag disposes the slider and corrupts the value.
    .on("change", ({ value, last }) => last && rebuildFrustum({ near: value }));
  frustumFolder
    .addBinding(geometry, "depth", kDepthRange)
    .on("change", ({ value, last }) => last && rebuildFrustum({ depth: value }));
  frustumFolder
    .addBinding(geometry, "showApex")
    .on("change", ({ value }) => rebuildFrustum({ showApex: value }));

  labelFolder.disposeAll();
  labelFolder.addBinding(target, "displayName");
  labelFolder.addBinding(target, "showNameBox");
}

type GeometryOverrides = Partial<typeof geometry>;

function rebuildFrustum(
  overrides: GeometryOverrides = {}
): void {
  // Defer to let the facade finish its current "change" emit before bindings are disposed.
  queueMicrotask(() => rebuildFrustumNow(overrides));
}

function rebuildFrustumNow(
  overrides: GeometryOverrides
): void {
  Object.assign(geometry, overrides);
  // Clamping here rather than keeping the two sliders on disjoint ranges: the
  // rebind below shows the clamped value, so the constraint stays visible.
  geometry.near = Math.min(
    geometry.near,
    geometry.depth * kMaxNearRatio
  );

  const { color, displayName, showNameBox, visible } = frustum;
  scene.remove(frustum);
  frustum.dispose();

  frustum = new PeerFrustum({
    ...geometry,
    color,
    displayName,
    showNameBox
  });
  frustum.visible = visible;
  scene.add(frustum);
  applyPose();

  bindFrustumControls(frustum);
}

frustum = new PeerFrustum({
  ...geometry,
  color: "#43aa8b",
  displayName: "Alice",
  showNameBox: true
});
scene.add(frustum);
applyPose();

bindFrustumControls(frustum);

poseFolder
  .addBinding(pose, "animate")
  .on("change", ({ value }) => {
    if (!value) {
      posePosition.copy(kRestingPosition);
      applyPose();
    }
  });
poseFolder.addBinding(pose, "speed", kSpeedRange);

startLoop({
  renderer,
  scene,
  camera,
  controls,
  onFrame: updatePose,
  onBeforeRender: () => performanceStats.begin(),
  onAfterRender: () => performanceStats.end()
});
