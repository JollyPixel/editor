// Import Third-party Dependencies
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import {
  Control,
  Controls,
  formatCount,
  formatMilliseconds,
  formatPercent
} from "@jolly-pixel/ui";

// Registers the declarative controls declared by the example page.
void Control;
void Controls;
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  loadTilesets,
  ViewDistance,
  VoxelRenderer,
  type VoxelDebugMode,
  type VoxelEngine
} from "../../src/index.ts";
import { RendererStats } from "./components/RendererStats.ts";
import { FreeFlyCamera } from "./components/FreeFlyCamera.ts";
import {
  TerrainBlock,
  generateTerrain,
  type TerrainStats
} from "./utils/terrain.ts";
import { createTerrainTileset } from "./utils/terrainAtlas.ts";
import {
  createExamplePane
} from "./utils/example-switcher.ts";

// CONSTANTS
const kTerrainLayer = "Terrain";
const kWaterLayer = "Water";
const kSkyColor = "#8ec5e8";
const kCameraSpeed = 120;

const kSizeBounds = {
  default: 256,
  min: 256,
  max: 5120
};
const kChunkBounds = {
  default: 32,
  min: 16,
  max: 256
};
const kSeedBounds = {
  default: 1337,
  min: 0,
  max: 0x7FFFFFFF
};
// Chunk radius the "view" folder can dial in; 0 means unlimited.
const kMaxViewDistance = 24;

interface WorldSettings {
  /** World width and depth in voxels. */
  size: number;
  chunkSize: number;
  seed: number;
}

interface BuildReport {
  terrain: TerrainStats;
  /** Time spent writing voxels through `VoxelEngine.setVoxel`. */
  generateMs: number;
  /** Time spent turning every dirty chunk into a THREE.Mesh. */
  meshMs: number;
  chunkCount: number;
}

const settings = readSettings();
const tileset = createTerrainTileset();

const tilesets = await loadTilesets([tileset.definition]);

const runtime = await Runtime.create("canvas", {
  includePerformanceStats: true,
  focusCanvas: false
});
const { world } = runtime;

const scene = world.sceneManager.getSource();
scene.background = new THREE.Color(kSkyColor);
// Fog hides the world border and keeps distant chunks cheap to look at.
const fog = new THREE.Fog(kSkyColor, settings.size * 0.5, settings.size * 1.7);
scene.fog = fog;

const sun = new THREE.DirectionalLight(new THREE.Color("#fff6e0"), 2.2);
sun.position.set(settings.size, settings.size * 1.5, settings.size * 0.5);
scene.add(
  new THREE.AmbientLight(new THREE.Color("#c6dcff"), 1.7),
  sun
);

const center = settings.size / 2;
const cameraDistance = settings.size * 0.7;
const cameraActor = world.createActor("camera")
  .addComponent(FreeFlyCamera, {
    position: { x: center, y: 70, z: center + cameraDistance },
    // Faces -Z, tilted down onto the middle of the terrain.
    yaw: 0,
    pitch: Math.atan2(10 - 70, cameraDistance),
    far: settings.size * 4,
    moveSpeed: kCameraSpeed,
    maxMoveSpeed: kCameraSpeed * 12
  });

const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, {
    // Terrain is generated from the origin outwards, so without a focus the
    // chunks under the camera would be the last ones meshed.
    focus: cameraActor.object3D,
    greedy: true,
    chunkSize: settings.chunkSize,
    layers: [kTerrainLayer, kWaterLayer],
    blocks: tileset.blocks,
    material: "lambert",
    alphaTest: 0.5,
    tilesets
  });

const { engine } = voxelMap;
const pane = createExamplePane({ title: "Noise World" });

let report: BuildReport | null = null;

const worldStats = {
  size: "",
  columns: 0,
  chunkSize: 0,
  voxels: 0,
  chunks: 0,
  trees: 0,
  generateMs: 0,
  meshMs: 0
};
const meshStats = {
  faces: 0,
  culled: 0,
  merged: 0,
  triangles: 0,
  vertices: 0,
  meshes: "",
  drawn: ""
};
const view = {
  /** Radius in chunks; 0 stands for the unlimited default. */
  distance: 0,
  policy: engine.viewDistancePolicy
};
// Mirrors the engine so the keyboard shortcuts and the pane never disagree.
const controls = {
  seed: settings.seed,
  greedy: engine.greedy,
  debug: engine.debug.mode
};

const worldFolder = pane.addFolder({ title: "World" });
worldFolder.addMonitors(worldStats, {
  size: { label: "size" },
  columns: { label: "columns", format: formatCount },
  chunkSize: { label: "chunk size", format: formatCount },
  voxels: { label: "voxels", format: formatCount },
  chunks: { label: "chunks", format: formatCount },
  trees: { label: "trees", format: formatCount },
  generateMs: { label: "generate", format: formatMilliseconds },
  meshMs: { label: "mesh build", format: formatMilliseconds }
});

const meshFolder = pane.addFolder({ title: "Mesh" });
meshFolder.addMonitors(meshStats, {
  faces: { label: "faces", format: formatCount },
  culled: { label: "culled", format: formatPercent },
  merged: { label: "merged", format: formatPercent },
  // Named apart from the renderer's own counters: these cover every built
  // chunk, not just what survived frustum culling this frame.
  triangles: { label: "mesh tris", format: formatCount },
  vertices: { label: "mesh verts", format: formatCount },
  meshes: { label: "meshes" },
  drawn: { label: "drawn chunks" }
});

const viewFolder = pane.addFolder({ title: "View" });
viewFolder
  .addBinding(view, "distance", {
    label: "distance",
    min: 0,
    max: kMaxViewDistance,
    step: 1
  })
  .on("change", () => applyViewDistance());
viewFolder
  .addBinding(view, "policy", {
    label: "policy",
    options: {
      hide: "hide",
      unload: "unload"
    }
  })
  .on("change", () => applyViewDistance());

const controlsFolder = pane.addFolder({ title: "Controls" });
// A plain number field: the seed range is far too wide for a slider.
controlsFolder.addBinding(controls, "seed", {
  step: 1,
  label: "seed"
});
controlsFolder
  .addButton({ title: "Rebuild [R]" })
  .on("click", () => rebuild(controls.seed));
controlsFolder
  .addBinding(controls, "greedy", { label: "greedy [M]" })
  .on("change", ({ value }) => setGreedy(value));
controlsFolder
  .addBinding(controls, "debug", {
    options: {
      off: "off",
      overlay: "overlay",
      wireframe: "wireframe"
    },
    label: "debug [G]"
  })
  .on("change", ({ value }) => setDebugMode(value));

// Chunks are meshed over several frames (the engine tick is budgeted), so the
// mesh counters are polled with the renderer counters on the same cadence.
world.createActor("hud")
  .addComponent(RendererStats, {
    folder: meshFolder,
    onRefresh: syncStats
  });

await loadRuntime(runtime, {
  skipLoadingScreen: true
});

report = buildWorld(engine, settings);
syncStats();

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    rebuild((settings.seed + 1) % kSeedBounds.max);

    return;
  }

  // off → wireframe over the textures → wireframe only.
  if (event.code === "KeyG") {
    setDebugMode(engine.debug.nextMode());

    return;
  }

  if (event.code === "KeyM") {
    setGreedy(!engine.greedy);
  }
});

/**
 * Regenerates the world from `seed`. Shared by the `R` key and the Rebuild
 * button, which is why the pane values are pushed back in.
 */
function rebuild(
  seed: number
): void {
  settings.seed = seed;
  controls.seed = seed;

  resetLayers(engine);
  report = buildWorld(engine, settings);
  syncStats();
  pane.refresh();
}

/**
 * Rebuilds every chunk in the other meshing mode; the textures must look
 * identical while the triangle count drops.
 */
function setGreedy(
  value: boolean
): void {
  if (engine.greedy === value) {
    return;
  }

  const meshStart = performance.now();
  engine.greedy = value;
  engine.tick(0);
  if (report !== null) {
    report.meshMs = performance.now() - meshStart;
  }

  controls.greedy = value;
  console.log(`[noise-world] greedy meshing: ${value}`);
  syncStats();
  pane.refresh();
}

/**
 * Reached from the dropdown and from `G`, which cycles the mode itself — hence
 * the assignment (a no-op for an unchanged mode) before the pane is synced.
 */
function setDebugMode(
  value: VoxelDebugMode
): void {
  engine.debug.mode = value;
  if (controls.debug === value) {
    return;
  }

  controls.debug = value;
  console.log(`[noise-world] debug mode: ${value}`);
  pane.refresh();
}

/**
 * A radius of 0 restores the unlimited default. The fog follows the radius so
 * chunks fade out instead of popping at the border.
 */
function applyViewDistance(): void {
  const { distance, policy } = view;

  engine.viewDistance = distance === 0 ?
    ViewDistance.Unlimited :
    new ViewDistance({ chunks: distance });
  engine.viewDistancePolicy = policy;

  if (distance === 0) {
    fog.near = settings.size * 0.5;
    fog.far = settings.size * 1.7;
  }
  else {
    // Ends on the hysteresis border, so a chunk is fully fogged out by the
    // time it is dropped.
    fog.far = (distance + 1) * settings.chunkSize;
    fog.near = fog.far * 0.55;
  }

  console.log(`[noise-world] view distance: ${distance || "unlimited"} (${policy})`);
  syncStats();
}

/**
 * Copies the latest build report and mesh counters into the bound state, then
 * repaints both folders.
 */
function syncStats(): void {
  if (report !== null) {
    const { terrain, generateMs, meshMs, chunkCount } = report;

    worldStats.size = `${settings.size} × ${settings.size}`;
    worldStats.columns = terrain.columnCount;
    worldStats.chunkSize = settings.chunkSize;
    worldStats.voxels = terrain.voxelCount;
    worldStats.chunks = chunkCount;
    worldStats.trees = terrain.treeCount;
    worldStats.generateMs = generateMs;
    worldStats.meshMs = meshMs;
  }

  const {
    faces, culledFaces, mergedFaces, triangles, vertices, meshes, chunks,
    culledChunks
  } = engine.debug.stats;
  const candidates = faces + culledFaces;
  const emitted = faces + mergedFaces;

  meshStats.faces = faces;
  meshStats.culled = candidates === 0 ? 0 : (culledFaces / candidates) * 100;
  meshStats.merged = emitted === 0 ? 0 : (mergedFaces / emitted) * 100;
  meshStats.triangles = triangles;
  meshStats.vertices = vertices;
  meshStats.meshes = `${formatCount(meshes)} / ${formatCount(chunks)}`;
  meshStats.drawn = `${formatCount(chunks - culledChunks)} / ${formatCount(chunks)}`;

  worldFolder.refresh();
  meshFolder.refresh();
  viewFolder.refresh();
}

/**
 * Fills both layers from the noise generator and measures the two costs that
 * matter: writing voxels, then meshing every dirty chunk.
 */
function buildWorld(
  engine: VoxelEngine,
  { seed, size }: WorldSettings
): BuildReport {
  const generateStart = performance.now();
  const terrain = generateTerrain(
    (position, blockId) => engine.world.setVoxel(
      blockId === TerrainBlock.Water ? kWaterLayer : kTerrainLayer,
      { position, blockId }
    ),
    { seed, size }
  );
  const generateMs = performance.now() - generateStart;

  // The renderer would mesh these chunks on its next update anyway; ticking
  // here makes the cost measurable instead of hiding it in a frame spike.
  const meshStart = performance.now();
  engine.tick(0);
  const meshMs = performance.now() - meshStart;

  const built = {
    terrain,
    generateMs,
    meshMs,
    chunkCount: countChunks(engine)
  };
  console.log("[noise-world] built", built);

  return built;
}

/**
 * Drops both layers and recreates them empty. Removals are processed by the
 * engine tick, so one is run before the layers come back.
 */
function resetLayers(
  engine: VoxelEngine
): void {
  engine.world.removeLayer(kTerrainLayer);
  engine.world.removeLayer(kWaterLayer);
  engine.tick(0);

  engine.world.addLayer(kTerrainLayer);
  engine.world.addLayer(kWaterLayer);
}

function countChunks(
  engine: VoxelEngine
): number {
  let total = 0;
  for (const layer of engine.world.getLayers()) {
    total += layer.chunkCount;
  }

  return total;
}

function readSettings(): WorldSettings {
  const params = new URLSearchParams(window.location.search);

  return {
    size: readInt(params, "size", kSizeBounds),
    chunkSize: readInt(params, "chunk", kChunkBounds),
    seed: readInt(params, "seed", kSeedBounds)
  };
}

function readInt(
  params: URLSearchParams,
  key: string,
  bounds: { default: number; min: number; max: number; }
): number {
  const value = Number.parseInt(params.get(key) ?? "", 10);
  if (Number.isNaN(value)) {
    return bounds.default;
  }

  return Math.min(bounds.max, Math.max(bounds.min, value));
}
