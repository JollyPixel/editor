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
  type VoxelView
} from "../../src/index.ts";
import { temporalAntialiasing } from "./noise-world/antialiasing.ts";
import { Daylight } from "./noise-world/daylight.ts";
import {
  generateTerrain,
  type TerrainStats
} from "./noise-world/terrain.ts";
import {
  createTerrainTileset,
  TERRAIN_BLEND_GROUPS
} from "./noise-world/terrainAtlas.ts";
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
const kMaxWorkers = 32;
const kWorkersBySize: ReadonlyArray<readonly [maxSize: number, workers: number]> = [
  [512, 1],
  [1024, 2],
  [Infinity, 4]
];
const kMaxViewDistance = 24;
const kFog = {
  density: 3,
  floor: 24,
  height: 64
};
const kFogDensityScale = 0.001;
const kDefaultViewChunks = 8;
const kFarChunks = 14;
const kMaxDetailChunks = 40;
const kMaxBlendWidth = 64;

interface WorldSettings {
  size: number;
  chunkSize: number;
  seed: number;
  workers: number;
}

interface BuildReport {
  terrain: TerrainStats;
  generateMs: number;
  meshMs: number;
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
const cameraDistance = Math.min(
  settings.size / 4,
  kDefaultViewChunks * settings.chunkSize / 2
);
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
    document: {
      chunkSize: settings.chunkSize,
      layers: [kTerrainLayer],
      blocks: tileset.blocks,
      blendGroups: TERRAIN_BLEND_GROUPS
    },
    tilesets,
    rendering: {
      material: "lambert",
      alphaTest: 0.5
    },
    lighting: {
      ambientOcclusion: kAmbientOcclusion,
      castShadow: true,
      receiveShadow: true
    },
    range: {
      viewDistance: kDefaultViewChunks,
      farDistance: kFarChunks
    },
    meshing: {
      workers: settings.workers > 0 ?
        {
          count: settings.workers,
          createWorker: () => new Worker(
            new URL("./noise-world/meshWorker.ts", import.meta.url),
            { type: "module" }
          )
        } :
        undefined
    }
  });

const { view: voxels } = voxelMap;
const chunkMeshes = voxels.root.getObjectByName("VoxelView:chunks");
if (chunkMeshes) {
  daylight.watchCasters(chunkMeshes);
}
const pane = createExamplePane({ title: "Noise World" });

let report: BuildReport | null = null;

const worldStats = {
  size: "",
  columns: 0,
  chunkSize: 0,
  trees: 0,
  workers: settings.workers,
  generateMs: 0,
  meshMs: 0
};
const viewStats = {
  drawn: ""
};
const view = {
  distance: kDefaultViewChunks,
  policy: voxels.range.policy,
  far: kFarChunks
};
const controls = {
  seed: settings.seed,
  minification: voxels.rendering.tileMinification,
  debug: voxels.inspector.mode,
  chunkBounds: voxels.inspector.chunkBounds,
  ambientOcclusion: true,
  shadows: daylight.shadows,
  alphaToCoverage: voxels.rendering.alphaToCoverage,
  blending: true,
  blendSpread: 1,
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
  workers: { label: "mesh workers", format: formatCount },
  generateMs: { label: "generate", format: formatMilliseconds },
  meshMs: { label: "mesh", format: formatMilliseconds }
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
  .on("change", () => applyFarDistance());
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
  .addBinding(controls, "minification", {
    options: {
      average: "average",
      nearest: "nearest"
    },
    label: "far tiles [N]"
  })
  .on("change", ({ value }) => {
    voxels.rendering.tileMinification = value;
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
    voxels.inspector.chunkBounds = value;
  });
controlsFolder
  .addBinding(controls, "ambientOcclusion", { label: "ambient occlusion" })
  .on("change", ({ value }) => {
    voxels.lighting.ambientOcclusion = value ? kAmbientOcclusion : 0;
  });
controlsFolder
  .addBinding(controls, "shadows", { label: "shadows" })
  .on("change", ({ value }) => {
    daylight.shadows = value;
    voxels.lighting.castShadow = value;
    voxels.lighting.receiveShadow = value;
  });
controlsFolder
  .addBinding(controls, "alphaToCoverage", { label: "alpha to coverage" })
  .on("change", ({ value }) => {
    voxels.rendering.alphaToCoverage = value;
  });
controlsFolder
  .addBinding(controls, "traa", { label: "TRAA [T]" })
  .on("change", ({ value }) => setTemporalAntialiasing(value));
controlsFolder
  .addBinding(controls, "blending", { label: "tile blending [B]" })
  .on("change", ({ value }) => setTileBlending(value));
controlsFolder
  .addBinding(controls, "blendSpread", {
    min: 0.25,
    max: 2,
    step: 0.25,
    label: "blend spread"
  })
  .on("change", () => setTileBlending(controls.blending));

runtime.metrics.addSource(voxels.inspector);
await runtime.mountMetricsPanel({
  target: pane,
  filter: (metric) => metric.tile === false
});
runtime.stats.subscribe(() => syncStats());

await runtime.load({
  skipLoadingScreen: true
});

report = buildWorld(voxels, settings);
syncStats();

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    rebuild((settings.seed + 1) % kSeedBounds.max);

    return;
  }

  if (event.code === "KeyG") {
    setDebugMode(voxels.inspector.nextMode());

    return;
  }

  if (event.code === "KeyN") {
    controls.minification = controls.minification === "average" ?
      "nearest" :
      "average";
    voxels.rendering.tileMinification = controls.minification;
    pane.refresh();

    return;
  }

  if (event.code === "KeyT") {
    setTemporalAntialiasing(!controls.traa);
    pane.refresh();
  }

  if (event.code === "KeyB") {
    setTileBlending(!controls.blending);
    pane.refresh();
  }
});

function setTileBlending(
  enabled: boolean
): void {
  controls.blending = enabled;
  for (const group of TERRAIN_BLEND_GROUPS) {
    if (enabled) {
      voxels.document.defineBlendGroup({
        ...group,
        width: blendWidth(group.width)
      });
    }
    else {
      voxels.document.removeBlendGroup(group.id);
    }
  }
}

function blendWidth(
  width = 8
): number {
  return Math.min(
    kMaxBlendWidth,
    Math.max(1, Math.round(width * controls.blendSpread))
  );
}

function rebuild(
  seed: number
): void {
  settings.seed = seed;
  controls.seed = seed;

  resetLayer(voxels);
  report = buildWorld(voxels, settings);
  syncStats();
  pane.refresh();
}

function setDebugMode(
  value: VoxelInspectorMode
): void {
  voxels.inspector.mode = value;
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

function applyFarDistance(): void {
  const { far } = view;

  voxels.range.farDistance = far === 0 ? Infinity : far;
  console.log(`[noise-world] flat tiles: ${far || "never"}`);
}

function applyViewDistance(): void {
  const { distance, policy } = view;

  voxels.range.viewDistance = distance === 0 ?
    ViewDistance.Unlimited :
    new ViewDistance({ chunks: distance });
  voxels.range.policy = policy;

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
    const { terrain, generateMs, meshMs } = report;

    worldStats.size = `${settings.size} × ${settings.size}`;
    worldStats.columns = terrain.columnCount;
    worldStats.chunkSize = settings.chunkSize;
    worldStats.trees = terrain.treeCount;
    worldStats.generateMs = generateMs;
    worldStats.meshMs = meshMs;
  }

  const { chunks, culledChunks } = voxels.inspector.mesh.stats;
  viewStats.drawn = `${formatCount(chunks - culledChunks)} / ${formatCount(chunks)}`;

  worldFolder.refresh();
  viewFolder.refresh();
}

function buildWorld(
  voxels: VoxelView,
  { seed, size }: WorldSettings
): BuildReport {
  const generateStart = performance.now();
  const terrain = generateTerrain(
    (position, blockId) => voxels.document.world.setVoxel(
      kTerrainLayer,
      { position, blockId }
    ),
    { seed, size }
  );
  const generateMs = performance.now() - generateStart;

  const built: BuildReport = {
    terrain,
    generateMs,
    meshMs: 0
  };
  const meshStart = performance.now();
  voxels.tick(0);
  void voxels.whenIdle().then(() => {
    built.meshMs = performance.now() - meshStart;
    console.log("[noise-world] meshed", built);
    syncStats();
  });

  return built;
}

function resetLayer(
  voxels: VoxelView
): void {
  voxels.document.world.removeLayer(kTerrainLayer);
  voxels.tick(0);

  voxels.document.world.addLayer(kTerrainLayer);
}

function readSettings(): WorldSettings {
  const params = new URLSearchParams(window.location.search);
  const size = readInt(params, "size", kSizeBounds);

  return {
    size,
    chunkSize: readInt(params, "chunk", kChunkBounds),
    seed: readInt(params, "seed", kSeedBounds),
    workers: readInt(params, "workers", {
      default: defaultWorkerCount(size),
      min: 0,
      max: kMaxWorkers
    })
  };
}

function defaultWorkerCount(
  size: number
): number {
  const [, workers] = kWorkersBySize.find(([maxSize]) => size <= maxSize)!;
  const spareCores = Math.max(1, navigator.hardwareConcurrency - 1);

  return Math.min(workers, spareCores);
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
