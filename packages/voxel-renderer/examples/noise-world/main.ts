// Import Third-party Dependencies
import { OrbitFlyCamera } from "@jolly-pixel/engine";
import { Runtime } from "@jolly-pixel/runtime";
import {
  loadBlocksets,
  ViewDistance,
  type TileMinification,
  type VoxelInspectorMode
} from "@jolly-pixel/voxel.renderer";
import {
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer/engine";
import {
  formatCount,
  formatMilliseconds
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { createExamplePane } from "../shared/example-pane.ts";
import { temporalAntialiasing } from "./antialiasing.ts";
import { Daylight } from "./daylight.ts";
import {
  MAX_SEED,
  WorldSettings
} from "./settings.ts";
import {
  createTerrainBlockset,
  TERRAIN_BLEND_GROUPS
} from "./terrainAtlas.ts";
import { WorldBuild } from "./WorldBuild.ts";

// CONSTANTS
const kTerrainLayer = "Terrain";
const kAmbientOcclusion = 0.75;
const kCameraSpeed = 120;
const kCameraHeight = 110;
const kCameraTargetHeight = 30;
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

const settings = new WorldSettings(new URLSearchParams(window.location.search));
const blockset = createTerrainBlockset();

const blocksets = await loadBlocksets([blockset.definition]);

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
      blocks: blockset.blocks
    },
    blocksets,
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
            new URL("./meshWorker.ts", import.meta.url),
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

let build: WorldBuild;

const worldStats = {
  size: `${settings.size} × ${settings.size}`,
  columns: settings.size * settings.size,
  chunkSize: settings.chunkSize,
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
  blending: false,
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
  .on("change", ({ value }) => setMinification(value));
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
runtime.stats.subscribe(() => syncViewStats());

await runtime.load({
  skipLoadingScreen: true
});

buildWorld(settings.seed);

const keyActions: Record<string, () => void> = {
  KeyR: () => rebuild((build.seed + 1) % MAX_SEED),
  KeyG: () => setDebugMode(voxels.inspector.nextMode()),
  KeyN: () => setMinification(
    controls.minification === "average" ? "nearest" : "average"
  ),
  KeyT: () => setTemporalAntialiasing(!controls.traa),
  KeyB: () => setTileBlending(!controls.blending)
};

document.addEventListener("keydown", (event) => {
  const action = keyActions[event.code];
  if (action) {
    action();
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
  controls.seed = seed;

  voxels.document.world.removeLayer(kTerrainLayer);
  voxels.tick(0);
  voxels.document.world.addLayer(kTerrainLayer);
  buildWorld(seed);
}

function buildWorld(
  seed: number
): void {
  const current = new WorldBuild(voxels, {
    layer: kTerrainLayer,
    seed,
    size: settings.size
  });
  build = current;
  syncWorldStats();
  void current.meshed.then(syncWorldStats);
}

function setDebugMode(
  value: VoxelInspectorMode
): void {
  voxels.inspector.mode = value;
  controls.debug = value;
}

function setMinification(
  value: TileMinification
): void {
  voxels.rendering.tileMinification = value;
  controls.minification = value;
}

function setTemporalAntialiasing(
  value: boolean
): void {
  controls.traa = value;
  flyCamera.postProcessing = value ? traaPipeline : null;
}

function applyFarDistance(): void {
  const { far } = view;

  voxels.range.farDistance = far === 0 ? Infinity : far;
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

  syncViewStats();
}

function syncWorldStats(): void {
  worldStats.trees = build.treeCount;
  worldStats.generateMs = build.generateMs;
  worldStats.meshMs = build.meshMs;
  worldFolder.refresh();
}

function syncViewStats(): void {
  const { chunks, culledChunks } = voxels.inspector.mesh.stats;
  viewStats.drawn = `${formatCount(chunks - culledChunks)} / ${formatCount(chunks)}`;
  viewFolder.refresh();
}
