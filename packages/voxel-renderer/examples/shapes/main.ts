// Import Third-party Dependencies
import * as THREE from "three";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import {
  builtinAOContext,
  color,
  float,
  mix,
  mrt,
  normalView,
  normalWorld,
  pass,
  screenUV,
  smoothstep,
  uniform
} from "three/tsl";
import { RenderPipeline } from "three/webgpu";
import { BlockShapeRegistry } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { createExamplePane } from "../shared/example-pane.ts";
import { OrbitViewer } from "../shared/OrbitViewer.ts";
import {
  OVERLAY_LAYER,
  createGround,
  createGroundLabel
} from "./ground.ts";
import {
  placeShapes,
  shapeGeometry
} from "./layout.ts";

// CONSTANTS
const kGap = 3;
const kSkyZenith = "#07080f";
const kSkyHorizon = "#2b2940";
const kFamilyColors: Record<string, string> = {
  cube: "#4a90d9",
  slab: "#7ed321",
  wall: "#9ccc65",
  pole: "#ab47bc",
  ramp: "#f5a623",
  stair: "#5c6bc0"
};

const placements = placeShapes(BlockShapeRegistry.createDefault());
const cols = Math.max(...placements.map(({ col }) => col)) + 1;
const rows = Math.max(...placements.map(({ row }) => row)) + 1;
const center = {
  x: ((cols - 1) * kGap * 0.5) + 0.5,
  y: 0.5,
  z: (-(rows - 1) * kGap * 0.5) + 0.5
};

const viewer = new OrbitViewer({
  position: { x: center.x, y: 14, z: center.z + 22 },
  target: center,
  background: kSkyHorizon,
  antialias: false
});
const { renderer, scene, camera, controls } = viewer;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
controls.maxPolarAngle = (Math.PI / 2) - 0.05;
camera.layers.enable(OVERLAY_LAYER);
const aoCamera = camera.clone();

scene.backgroundNode = mix(
  color(kSkyHorizon),
  color(kSkyZenith),
  smoothstep(0, 0.6, normalWorld.y)
);
scene.fog = new THREE.Fog(kSkyHorizon, 30, 90);

const sun = new THREE.DirectionalLight("#fff1dc", 2);
sun.position.set(center.x + 7, 12, center.z + 9);
sun.target.position.set(center.x, 0, center.z);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
const shadowExtent = Math.max(cols, rows) * kGap * 0.75;
Object.assign(sun.shadow.camera, {
  left: -shadowExtent,
  right: shadowExtent,
  top: shadowExtent,
  bottom: -shadowExtent,
  near: 1,
  far: 40
});

const labels = new THREE.Group();
const wireframes = new THREE.Group();
wireframes.visible = false;
scene.add(
  new THREE.HemisphereLight("#c9d6ff", "#4a3e58", 2.6),
  sun,
  sun.target,
  createGround(center),
  labels,
  wireframes
);

const wireMaterial = new THREE.MeshBasicMaterial({
  color: "#000000",
  wireframe: true
});

for (const { shape, family, col, row } of placements) {
  const x = col * kGap;
  const z = -row * kGap;
  const geometry = shapeGeometry(shape);

  const solid = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(kFamilyColors[family])
        .offsetHSL(0, 0, ((col % 5) - 2) * 0.06),
      flatShading: true,
      roughness: 0.75
    })
  );
  solid.position.set(x, 0, z);
  solid.castShadow = true;
  solid.receiveShadow = true;
  scene.add(solid);

  const wire = new THREE.Mesh(geometry, wireMaterial);
  wire.position.set(x, 0, z);
  wire.layers.set(OVERLAY_LAYER);
  wireframes.add(wire);

  const label = createGroundLabel(shape.id);
  label.position.set(x + 0.5, 0, z + 1.35);
  labels.add(label);
}

const prePass = pass(scene, aoCamera, { samples: 0 });
prePass.setLayers(new THREE.Layers());
prePass.setMRT(mrt({ output: normalView }));

const aoPass = ao(prePass.getTextureNode("depth"), prePass.getTextureNode(), aoCamera);
aoPass.radius.value = 1;
aoPass.scale.value = 1.6;

const aoStrength = uniform(1);
const scenePass = pass(scene, camera, { samples: 4 });
scenePass.contextNode = builtinAOContext(
  mix(float(1), aoPass.getTextureNode().sample(screenUV).r, aoStrength)
);

const pipeline = new RenderPipeline(renderer, scenePass);

const display = {
  labels: true,
  wireframe: false,
  ambientOcclusion: true
};

const pane = createExamplePane({ title: "Block Shapes" });
pane
  .addBinding(display, "labels", { label: "labels" })
  .on("change", ({ value }) => (labels.visible = value));
pane
  .addBinding(display, "wireframe", { label: "wireframe" })
  .on("change", ({ value }) => (wireframes.visible = value));
pane
  .addBinding(display, "ambientOcclusion", { label: "ambient occlusion" })
  .on("change", ({ value }) => (aoStrength.value = value ? 1 : 0));

await viewer.start({
  render: () => {
    aoCamera.copy(camera);
    pipeline.render();
  }
});
