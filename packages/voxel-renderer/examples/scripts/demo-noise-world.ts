// Import Third-party Dependencies
import { OrbitFlyCamera } from "@jolly-pixel/engine";
import { Runtime } from "@jolly-pixel/runtime";
import {
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer/engine";
import {
  Control,
  Controls,
  formatCount,
  formatMilliseconds
} from "@jolly-pixel/ui";

void Control;
void Controls;
// Import Internal Dependencies
import {
  loadTilesets,
  ViewDistance,
  type VoxelInspectorMode,
  type VoxelEngine
} from "../../src/index.ts";
import { temporalAntialiasing } from "./noise-world/antialiasing.ts";
import { Daylight } from "./noise-world/daylight.ts";
import {
  generateTerrain,
  type TerrainStats
} from "./noise-world/terrain.ts";
import { createTerrainTileset } from "./noise-world/terrainAtlas.ts";
import {
  createExamplePane
} from "./utils/example-switcher.ts";

// CONSTANTS
const kTerrainLayer = "Terrain";
const kAmbientOcclusion = 0.75;
const kCameraSpeed = 120;
const kCameraHeight = 110;
const kCameraTargetHeight = 30;

const kSizeBounds = {
  default: 512,
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
const kMaxViewDistance = 24;
const kFog = {
  density: 3,
  floor: 24,
  height: 64
};
const kFogDensityScale = 0.001;
const kDefaultViewChunks = 8;
const kFarChunks = 14;
const kLodChunks = 20;
const kMaxDetailChunks = 40;

interface WorldSettings {
  size: number;
  chunkSize: number;
  seed: number;
}

interface BuildReport {
  terrain: TerrainStats;
  generateMs: number;
}

const settings = readSettings();
const tileset = createTerrainTileset();

const tilesets = await loadTilesets([tileset.definition]);

const runtime = await Runtime.create("canvas", {
  includePerformanceStats: true,
  focusCanvas: false,
  viewHelper: true
});
const { world } = runtime;

const scene = world.sceneManager.getSource();

const center = settings.size / 2;
const cameraDistance = settings.size * 0.7;
const flyCamera = world.createActor("camera")
  .addComponentAndGet(OrbitFlyCamera, {
    position: { x: center, y: kCameraHeight, z: center + cameraDistance },
    yaw: 0,
    pitch: Math.atan2(kCameraTargetHeight - kCameraHeight, cameraDistance),
    far: settings.size * 4,
    moveSpeed: kCameraSpeed,
    maxMoveSpeed: kCameraSpeed * 12
  });
const daylight = flyCamera.actor.addComponentAndGet(Daylight, {
  camera: flyCamera.camera,
  scene,
  renderer: world.renderer.getSource(),
  fog: {
    density: kFog.density * kFogDensityScale,
    floor: kFog.floor,
    height: kFog.height
  }
});

const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, {
    focus: flyCamera.actor.object3D,
    greedy: true,
    chunkSize: settings.chunkSize,
    layers: [kTerrainLayer],
    blocks: tileset.blocks,
    material: "lambert",
    alphaTest: 0.5,
    ambientOcclusion: kAmbientOcclusion,
    castShadow: true,
    receiveShadow: true,
    viewDistance: kDefaultViewChunks,
    farDistance: kFarChunks * settings.chunkSize,
    lodDistance: kLodChunks * settings.chunkSize,
    tilesets
  });

const { engine } = voxelMap;
const pane = createExamplePane({ title: "Noise World" });

let report: BuildReport | null = null;

const worldStats = {
  size: "",
  columns: 0,
  chunkSize: 0,
  trees: 0,
  generateMs: 0
};
const viewStats = {
  drawn: ""
};
const view = {
  distance: kDefaultViewChunks,
  policy: engine.viewDistancePolicy,
  far: kFarChunks,
  lod: kLodChunks
};
const controls = {
  seed: settings.seed,
  greedy: engine.greedy,
  minification: engine.tileMinification,
  debug: engine.inspector.mode,
  chunkBounds: engine.inspector.chunkBounds,
  ambientOcclusion: true,
  shadows: daylight.shadows,
  alphaToCoverage: engine.alphaToCoverage,
  traa: true
};
const traaPipeline = temporalAntialiasing();
flyCamera.postProcessing = traaPipeline;

const worldFolder = pane.addFolder({ title: "World" });
worldFolder.addMonitors(worldStats, {
  size: { label: "size" },
  columns: { label: "columns", format: formatCount },
  chunkSize: { label: "chunk size", format: formatCount },
  trees: { label: "trees", format: formatCount },
  generateMs: { label: "generate", format: formatMilliseconds }
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
viewFolder
  .addBinding(view, "far", {
    label: "flat tiles",
    min: 0,
    max: kMaxDetailChunks,
    step: 1
  })
  .on("change", () => applyDetailDistances());
viewFolder
  .addBinding(view, "lod", {
    label: "half resolution",
    min: 0,
    max: kMaxDetailChunks,
    step: 1
  })
  .on("change", () => applyDetailDistances());
viewFolder.addMonitor(viewStats, "drawn", { label: "drawn chunks" });
applyViewDistance();

const fogControls = { ...kFog };
const fogFolder = pane.addFolder({ title: "Fog" });
fogFolder
  .addBinding(fogControls, "density", {
    label: "density",
    min: 0,
    max: 10,
    step: 0.25
  })
  .on("change", ({ value }) => {
    daylight.fog.density.value = value * kFogDensityScale;
  });
fogFolder
  .addBinding(fogControls, "floor", {
    label: "floor",
    min: 0,
    max: 128,
    step: 1
  })
  .on("change", ({ value }) => {
    daylight.fog.floor.value = value;
  });
fogFolder
  .addBinding(fogControls, "height", {
    label: "height",
    min: 8,
    max: 256,
    step: 8
  })
  .on("change", ({ value }) => {
    daylight.fog.height.value = value;
  });

const controlsFolder = pane.addFolder({ title: "Controls" });
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
  .addBinding(controls, "minification", {
    options: {
      average: "average",
      nearest: "nearest"
    },
    label: "far tiles [N]"
  })
  .on("change", ({ value }) => {
    engine.tileMinification = value;
  });
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
controlsFolder
  .addBinding(controls, "chunkBounds", { label: "chunk bounds" })
  .on("change", ({ value }) => {
    engine.inspector.chunkBounds = value;
  });
controlsFolder
  .addBinding(controls, "ambientOcclusion", { label: "ambient occlusion" })
  .on("change", ({ value }) => {
    engine.ambientOcclusion = value ? kAmbientOcclusion : 0;
  });
controlsFolder
  .addBinding(controls, "shadows", { label: "shadows" })
  .on("change", ({ value }) => {
    daylight.shadows = value;
    engine.castShadow = value;
    engine.receiveShadow = value;
  });
controlsFolder
  .addBinding(controls, "alphaToCoverage", { label: "alpha to coverage" })
  .on("change", ({ value }) => {
    engine.alphaToCoverage = value;
  });
controlsFolder
  .addBinding(controls, "traa", { label: "TRAA [T]" })
  .on("change", ({ value }) => setTemporalAntialiasing(value));

runtime.metrics.addSource(engine.inspector);
await runtime.mountMetricsPanel({
  target: pane,
  filter: (metric) => metric.tile === false
});
runtime.stats.subscribe(() => syncStats());

await runtime.load({
  skipLoadingScreen: true
});

report = buildWorld(engine, settings);
syncStats();

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    rebuild((settings.seed + 1) % kSeedBounds.max);

    return;
  }

  if (event.code === "KeyG") {
    setDebugMode(engine.inspector.nextMode());

    return;
  }

  if (event.code === "KeyN") {
    controls.minification = controls.minification === "average" ?
      "nearest" :
      "average";
    engine.tileMinification = controls.minification;
    pane.refresh();

    return;
  }

  if (event.code === "KeyM") {
    setGreedy(!engine.greedy);

    return;
  }

  if (event.code === "KeyT") {
    setTemporalAntialiasing(!controls.traa);
    pane.refresh();
  }
});

function rebuild(
  seed: number
): void {
  settings.seed = seed;
  controls.seed = seed;

  resetLayer(engine);
  report = buildWorld(engine, settings);
  syncStats();
  pane.refresh();
}

function setGreedy(
  value: boolean
): void {
  if (engine.greedy === value) {
    return;
  }

  engine.greedy = value;
  engine.tick(0);

  controls.greedy = value;
  console.log(`[noise-world] greedy meshing: ${value}`);
  syncStats();
  pane.refresh();
}

function setDebugMode(
  value: VoxelInspectorMode
): void {
  engine.inspector.mode = value;
  if (controls.debug === value) {
    return;
  }

  controls.debug = value;
  console.log(`[noise-world] debug mode: ${value}`);
  pane.refresh();
}

function setTemporalAntialiasing(
  value: boolean
): void {
  controls.traa = value;
  flyCamera.postProcessing = value ? traaPipeline : null;
  console.log(`[noise-world] TRAA: ${value}`);
}

function applyDetailDistances(): void {
  const { far, lod } = view;

  engine.farDistance = far === 0 ? Infinity : far * settings.chunkSize;
  engine.lodDistance = lod === 0 ? Infinity : lod * settings.chunkSize;
  console.log(
    `[noise-world] flat tiles: ${far || "never"}, half resolution: ${lod || "never"}`
  );
}

function applyViewDistance(): void {
  const { distance, policy } = view;

  engine.viewDistance = distance === 0 ?
    ViewDistance.Unlimited :
    new ViewDistance({ chunks: distance });
  engine.viewDistancePolicy = policy;

  if (distance === 0) {
    daylight.fog.unveil();
  }
  else {
    daylight.fog.veil(distance * settings.chunkSize, settings.chunkSize);
  }

  console.log(`[noise-world] view distance: ${distance || "unlimited"} (${policy})`);
  syncStats();
}

function syncStats(): void {
  if (report !== null) {
    const { terrain, generateMs } = report;

    worldStats.size = `${settings.size} × ${settings.size}`;
    worldStats.columns = terrain.columnCount;
    worldStats.chunkSize = settings.chunkSize;
    worldStats.trees = terrain.treeCount;
    worldStats.generateMs = generateMs;
  }

  const { chunks, culledChunks } = engine.inspector.mesh.stats;
  viewStats.drawn = `${formatCount(chunks - culledChunks)} / ${formatCount(chunks)}`;

  worldFolder.refresh();
  viewFolder.refresh();
}

function buildWorld(
  engine: VoxelEngine,
  { seed, size }: WorldSettings
): BuildReport {
  const generateStart = performance.now();
  const terrain = generateTerrain(
    (position, blockId) => engine.world.setVoxel(
      kTerrainLayer,
      { position, blockId }
    ),
    { seed, size }
  );
  const generateMs = performance.now() - generateStart;

  engine.tick(0);

  const built = {
    terrain,
    generateMs
  };
  console.log("[noise-world] built", built);

  return built;
}

function resetLayer(
  engine: VoxelEngine
): void {
  engine.world.removeLayer(kTerrainLayer);
  engine.tick(0);

  engine.world.addLayer(kTerrainLayer);
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
