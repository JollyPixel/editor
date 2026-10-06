// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  loadBlocksets,
  VoxelDocument,
  VoxelView,
  type VoxelInspectorMode
} from "../../src/index.ts";
import {
  type LabelEntry,
  createLabel,
  createOrbitCamera,
  createRenderer,
  createScene,
  startLoop
} from "./utils/common.ts";
import {
  createExamplePane
} from "./utils/example-switcher.ts";
import { createTransparencyBlockset } from "./utils/transparencyAtlas.ts";
import {
  LAYER_SPECS,
  SCENE_LABELS,
  WORLD_SIZE,
  buildScene
} from "./utils/transparencyScene.ts";

// CONSTANTS
const kCenter = WORLD_SIZE / 2;
const kSunRadius = WORLD_SIZE * 1.8;

type ChunkMaterial = THREE.MeshLambertMaterial | THREE.MeshStandardMaterial;

const params = new URLSearchParams(window.location.search);
const materialType = params.get("material") === "standard" ? "standard" : "lambert";

const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

// ── Engine ────────────────────────────────────────────────────────────────────

const blockset = createTransparencyBlockset();

const blocksets = await loadBlocksets([blockset.definition]);

/**
 * Every material the engine mints, kept so the panel can drive `alphaTest` and
 * the shading knobs at runtime. They are created lazily, which is why the
 * customizer also applies the current state to each newcomer.
 */
const materials = new Set<ChunkMaterial>();

const materialState = {
  alphaTest: 0.1,
  flatShading: false,
  /** Engine default for a blended material; turn it off to see what it buys. */
  depthWrite: true,
  roughness: 0.85,
  metalness: 0
};

const voxelDocument = new VoxelDocument({
  chunkSize: 16,
  blocks: blockset.blocks
});
const voxels = new VoxelView(voxelDocument, {
  blocksets,
  rendering: {
    material: materialType,
    alphaTest: materialState.alphaTest,
    customizer: (material) => {
      materials.add(material);
      applyMaterialState(material);
    }
  }
});

buildScene(voxelDocument.world);
voxels.init();

// ── Scene ─────────────────────────────────────────────────────────────────────

const renderer = createRenderer(canvas);
const scene = createScene();
// Kept as our own instance so the colour picker can write straight into it.
const background = new THREE.Color("#1d2b3a");
scene.background = background;

const { camera, controls } = createOrbitCamera(
  canvas,
  { x: kCenter, y: 18, z: kCenter + 26 },
  { x: kCenter, y: 3, z: kCenter }
);
scene.add(voxels.root);

const ambient = new THREE.AmbientLight("#c6dcff", 0.9);
const hemisphere = new THREE.HemisphereLight("#9fd4ff", "#4a3a2a", 0.8);
const sun = new THREE.DirectionalLight("#fff6e0", 2);
sun.target.position.set(kCenter, 2, kCenter);
scene.add(ambient, hemisphere, sun, sun.target);

const labelEntries: LabelEntry[] = SCENE_LABELS.map(
  ({ text, x, y, z }) => createLabel(text, new THREE.Vector3(x, y, z))
);

// ── Panel ─────────────────────────────────────────────────────────────────────

const pane = createExamplePane({ title: "Transparency & Light" });

const layerState = LAYER_SPECS.map(({ name, hint }) => {
  return {
    name,
    hint,
    visible: true
  };
});

const lightState = {
  background: `#${background.getHexString()}`,
  ambient: ambient.intensity,
  ambientColor: `#${ambient.color.getHexString()}`,
  hemisphere: hemisphere.intensity,
  sun: sun.intensity,
  sunColor: `#${sun.color.getHexString()}`,
  azimuth: 45,
  elevation: 45,
  spin: false,
  tone: "none",
  exposure: 1
};

const meshState = {
  faces: 0,
  culled: 0,
  triangles: 0
};

const debugState = {
  mode: voxels.inspector.mode
};

const layersFolder = pane.addFolder({ title: "Layers" });
for (const layer of layerState) {
  layersFolder
    .addBinding(layer, "visible", { label: `${layer.name} on` })
    .on("change", ({ value }) => updateLayer(layer.name, value));
}

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

const meshFolder = pane.addFolder({ title: "Mesh" });
meshFolder
  .addBinding(debugState, "mode", {
    label: "debug [G]",
    options: { off: "off", overlay: "overlay", wireframe: "wireframe" }
  })
  .on("change", ({ value }) => setDebugMode(value));

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyG") {
    setDebugMode(voxels.inspector.nextMode());
  }
});

updateSun();
syncStats();

// ── Loop ──────────────────────────────────────────────────────────────────────

let lastTime = performance.now();
let frame = 0;

await startLoop({
  renderer,
  scene,
  camera,
  controls,
  labelEntries,
  onFrame: () => {
    const now = performance.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    if (lightState.spin) {
      lightState.azimuth = (lightState.azimuth + (deltaTime * 20)) % 360;
      updateSun();
    }

    voxels.tick(deltaTime);
    if (frame++ % 30 === 0) {
      syncStats();
    }
  }
});

/**
 * Pushes the panel's state onto one material. `needsUpdate` is unconditional:
 * both `alphaTest` crossing zero and `flatShading` change shader defines.
 */
function applyMaterialState(
  material: ChunkMaterial
): void {
  material.alphaTest = materialState.alphaTest;
  material.flatShading = materialState.flatShading;
  /*
   * Opaque materials write depth whatever the panel says; the toggle is about
   * what blending does without it.
   * `side` is deliberately left alone: the engine picks it per material, and
   * overwriting it here would put the cutout pass back to single-sided.
   */
  if (material.transparent) {
    material.depthWrite = materialState.depthWrite;
  }
  if (material instanceof THREE.MeshStandardMaterial) {
    material.roughness = materialState.roughness;
    material.metalness = materialState.metalness;
  }

  material.needsUpdate = true;
}

function updateLayer(
  name: string,
  visible: boolean
): void {
  voxelDocument.world.updateLayer(name, { visible });
  voxels.flush();
  syncStats();
}

function setDebugMode(
  value: VoxelInspectorMode
): void {
  voxels.inspector.mode = value;
  if (debugState.mode === value) {
    return;
  }

  debugState.mode = value;
  pane.refresh();
}

function syncStats(): void {
  const { faces, culledFaces, triangles } = voxels.inspector.mesh.stats;
  const candidates = faces + culledFaces;

  meshState.faces = faces;
  meshState.culled = candidates === 0 ? 0 : (culledFaces / candidates) * 100;
  meshState.triangles = triangles;

  meshFolder.refresh();
}

function updateSun(): void {
  const azimuth = THREE.MathUtils.degToRad(lightState.azimuth);
  const elevation = THREE.MathUtils.degToRad(lightState.elevation);
  const ground = Math.cos(elevation) * kSunRadius;

  sun.position.set(
    kCenter + (Math.sin(azimuth) * ground),
    Math.sin(elevation) * kSunRadius,
    kCenter + (Math.cos(azimuth) * ground)
  );
}
