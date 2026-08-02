// Import Third-party Dependencies
import { Camera3DControls } from "@jolly-pixel/engine";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import {
  TilesetLoader,
  VoxelRenderer,
  type VoxelDebugger,
  type VoxelEngine
} from "../../src/index.ts";
import { PerformanceHUD, hudLine } from "./components/PerformanceHUD.ts";
import {
  TerrainBlock,
  generateTerrain,
  type TerrainStats
} from "./utils/terrain.ts";
import { createTerrainTileset } from "./utils/terrainAtlas.ts";
import { createExamplesMenu } from "./utils/menu.ts";

// CONSTANTS
const kTerrainLayer = "Terrain";
const kWaterLayer = "Water";
const kSkyColor = "#8ec5e8";
const kCameraSpeed = 60;

const kSizeBounds = {
  default: 1024,
  min: 256,
  max: 1024
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

const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

const settings = readSettings();
const tileset = createTerrainTileset();

const tilesetLoader = new TilesetLoader();
await tilesetLoader.fromTileDefinition(tileset.definition);

const runtime = new Runtime(canvas, {
  includePerformanceStats: true
});
const { world } = runtime;

const scene = world.sceneManager.getSource();
scene.background = new THREE.Color(kSkyColor);
// Fog hides the world border and keeps distant chunks cheap to look at.
scene.fog = new THREE.Fog(kSkyColor, settings.size * 0.5, settings.size * 1.7);

const sun = new THREE.DirectionalLight(new THREE.Color("#fff6e0"), 2.2);
sun.position.set(settings.size, settings.size * 1.5, settings.size * 0.5);
scene.add(
  new THREE.AmbientLight(new THREE.Color("#c6dcff"), 1.7),
  sun
);

world.createActor("camera")
  .addComponent(Camera3DControls, {
    speed: kCameraSpeed,
    far: settings.size * 4
  }, (component) => {
    const center = settings.size / 2;
    component.actor.transform
      .setLocalPosition({ x: center, y: 70, z: center + (settings.size * 0.7) })
      .lookAt({ x: center, y: 10, z: center });
  });

const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, {
    greedy: true,
    chunkSize: settings.chunkSize,
    layers: [kTerrainLayer, kWaterLayer],
    blocks: tileset.blocks,
    material: "lambert",
    alphaTest: 0.5,
    tilesetLoader
  });

let report: BuildReport | null = null;

world.createActor("hud")
  .addComponent(PerformanceHUD, {
    title: "NOISE WORLD",
    details: () => [
      ...describeBuild(settings, report),
      ...describeMesh(voxelMap.engine.debug, voxelMap.engine.greedy)
    ]
  });

createExamplesMenu();
await loadRuntime(runtime);

const { engine } = voxelMap;
report = buildWorld(engine, settings);

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    settings.seed = (settings.seed + 1) % kSeedBounds.max;
    resetLayers(engine);
    report = buildWorld(engine, settings);

    return;
  }

  // off → wireframe over the textures → wireframe only.
  if (event.code === "KeyG") {
    console.log(`[noise-world] debug mode: ${engine.debug.nextMode()}`);

    return;
  }

  // Rebuilds every chunk in the other meshing mode; the textures must look
  // identical while the triangle count drops.
  if (event.code === "KeyM") {
    const meshStart = performance.now();
    engine.greedy = !engine.greedy;
    engine.tick(0);

    if (report !== null) {
      report.meshMs = performance.now() - meshStart;
    }
    console.log(`[noise-world] greedy meshing: ${engine.greedy}`);
  }
});

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
    (position, blockId) => engine.setVoxel(
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
  engine.removeLayer(kTerrainLayer);
  engine.removeLayer(kWaterLayer);
  engine.tick(0);

  engine.addLayer(kTerrainLayer);
  engine.addLayer(kWaterLayer);
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

function describeBuild(
  config: WorldSettings,
  build: BuildReport | null
): string[] {
  if (build === null) {
    return [hudLine("World", "generating…")];
  }

  const { terrain, generateMs, meshMs, chunkCount } = build;
  const columns = terrain.columnCount.toLocaleString("en-US");
  const voxelsPerMs = Math.round(terrain.voxelCount / generateMs).toLocaleString("en-US");

  return [
    hudLine("World", `${config.size} × ${config.size}  (${columns} col.)`),
    hudLine("Chunk Size", config.chunkSize),
    hudLine("Voxels", terrain.voxelCount),
    hudLine("Chunks", chunkCount),
    hudLine("Trees", terrain.treeCount),
    hudLine("Generate", `${generateMs.toFixed(1)} ms  (${voxelsPerMs}/ms)`),
    hudLine("Mesh Build", `${meshMs.toFixed(1)} ms`),
    hudLine("Seed", `${config.seed}  [R to rebuild]`)
  ];
}

/**
 * Geometry actually produced by the mesh builder, refreshed on every HUD tick
 * so it follows chunk rebuilds.
 */
function describeMesh(
  debug: VoxelDebugger,
  greedy: boolean
): string[] {
  const {
    faces, culledFaces, mergedFaces, triangles, vertices, meshes, chunks
  } = debug.stats;

  const candidates = faces + culledFaces;
  const culled = candidates === 0 ? 0 : (culledFaces / candidates) * 100;
  const emitted = faces + mergedFaces;
  const merged = emitted === 0 ? 0 : (mergedFaces / emitted) * 100;

  return [
    hudLine("Faces", `${faces.toLocaleString("en-US")}  (${culled.toFixed(1)}% culled)`),
    hudLine(
      "Greedy",
      greedy ? `on  (${merged.toFixed(1)}% merged)  [M]` : "off  [M to toggle]"
    ),
    // Named apart from the renderer's own counters above: these cover every
    // built chunk, not just what survived frustum culling this frame.
    hudLine("Mesh Tris", triangles),
    hudLine("Mesh Verts", vertices),
    hudLine("Chunk Meshes", `${meshes.toLocaleString("en-US")} / ${chunks.toLocaleString("en-US")} chunks`),
    hudLine("Debug Mesh", `${debug.mode}  [G to cycle]`)
  ];
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
