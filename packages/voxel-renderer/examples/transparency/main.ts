// Import Third-party Dependencies
import * as THREE from "three";
import {
  loadBlocksets,
  VoxelDocument,
  VoxelView,
  type VoxelInspectorMode
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { createExamplePane } from "../shared/example-pane.ts";
import { OrbitViewer } from "../shared/OrbitViewer.ts";
import { createTransparencyBlockset } from "./atlas.ts";
import {
  SCENE_LABELS,
  TRANSPARENCY_LAYERS,
  WORLD_SIZE,
  buildScene
} from "./scene.ts";

// CONSTANTS
const kCenter = WORLD_SIZE / 2;
const kSunRadius = WORLD_SIZE * 1.8;
const kAlphaTest = 0.1;
const kStandardRoughness = 0.85;

const params = new URLSearchParams(window.location.search);
const materialType = params.get("material") === "standard" ? "standard" : "lambert";

const blockset = createTransparencyBlockset();
const voxelDocument = new VoxelDocument({
  chunkSize: 16,
  blocks: blockset.blocks
});
const voxels = new VoxelView(voxelDocument, {
  blocksets: await loadBlocksets([blockset.definition]),
  rendering: {
    material: materialType,
    alphaTest: kAlphaTest,
    customizer: (material) => {
      material.alphaTest = kAlphaTest;
      if (material.transparent) {
        material.depthWrite = true;
      }
      if (material instanceof THREE.MeshStandardMaterial) {
        material.roughness = kStandardRoughness;
      }
    }
  }
});

buildScene(voxelDocument.world);
voxels.init();

const viewer = new OrbitViewer({
  position: { x: kCenter, y: 18, z: kCenter + 26 },
  target: { x: kCenter, y: 3, z: kCenter },
  background: "#1d2b3a"
});
const { scene, background } = viewer;

const ambient = new THREE.AmbientLight("#c6dcff", 0.9);
const hemisphere = new THREE.HemisphereLight("#9fd4ff", "#4a3a2a", 0.8);
const sun = new THREE.DirectionalLight("#fff6e0", 2);
sun.position.set(
  kCenter + (kSunRadius / 2),
  kSunRadius * Math.SQRT1_2,
  kCenter + (kSunRadius / 2)
);
sun.target.position.set(kCenter, 2, kCenter);
scene.add(voxels.root, ambient, hemisphere, sun, sun.target);

for (const { text, x, y, z } of SCENE_LABELS) {
  viewer.label(text, { x, y, z });
}

const pane = createExamplePane({ title: "Transparency & Light" });

const layersFolder = pane.addFolder({ title: "Layers" });
for (const name of TRANSPARENCY_LAYERS) {
  layersFolder
    .addBinding({ visible: true }, "visible", { label: `${name} on` })
    .on("change", ({ value }) => {
      voxelDocument.world.updateLayer(name, { visible: value });
      voxels.flush();
    });
}

const lightState = {
  background: `#${background.getHexString()}`,
  ambient: ambient.intensity,
  hemisphere: hemisphere.intensity,
  sun: sun.intensity
};

const lightFolder = pane.addFolder({ title: "Light" });
lightFolder
  .addBinding(lightState, "background", { label: "background" })
  .on("change", ({ value }) => background.set(value));
lightFolder
  .addBinding(lightState, "ambient", { label: "ambient", min: 0, max: 4, step: 0.05 })
  .on("change", ({ value }) => (ambient.intensity = value));
lightFolder
  .addBinding(lightState, "hemisphere", { label: "hemisphere", min: 0, max: 4, step: 0.05 })
  .on("change", ({ value }) => (hemisphere.intensity = value));
lightFolder
  .addBinding(lightState, "sun", { label: "sun", min: 0, max: 6, step: 0.05 })
  .on("change", ({ value }) => (sun.intensity = value));

const debugState = {
  mode: voxels.inspector.mode
};

pane
  .addFolder({ title: "Mesh" })
  .addBinding(debugState, "mode", {
    label: "debug [G]",
    options: { off: "off", overlay: "overlay", wireframe: "wireframe" }
  })
  .on("change", ({ value }) => setDebugMode(value));

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyG") {
    setDebugMode(voxels.inspector.nextMode());
    pane.refresh();
  }
});

await viewer.start({
  onFrame: (deltaTime) => voxels.tick(deltaTime)
});

function setDebugMode(
  value: VoxelInspectorMode
): void {
  voxels.inspector.mode = value;
  debugState.mode = value;
}
