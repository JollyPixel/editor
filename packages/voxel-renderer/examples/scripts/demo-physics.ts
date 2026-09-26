// Import Third-party Dependencies
import RAPIER from "@dimforge/rapier3d";
import {
  CameraComponent
} from "@jolly-pixel/engine";
import {
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer/engine";
import { Runtime } from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import {
  loadTilesets,
  Face,
  type BlockDefinition
} from "../../src/index.ts";
import { RapierVoxelCollider } from "../../src/plugins/rapier/index.ts";
import { SphereBehavior } from "./components/SphereController.ts";
import { FollowCamera } from "./components/FollowCamera.ts";
import {
  createExamplePane
} from "./utils/example-switcher.ts";

// CONSTANTS
const kTerrainSize = 32;
const kPlatformMin = 12;
const kPlatformMax = 19;
const kPlatformHeight = 2;
const kSphereRadius = 0.5;
const kDirtId = 1;
const kSlabId = 2;
const kRampId = 3;
const kStairId = 4;
const kPoleId = 5;

/*
 * @dimforge/rapier3d 0.19.x loads its WASM binary via a static bundler import
 * (`import * as wasm from "./rapier_wasm3d_bg.wasm"`) — no explicit init() call
 * is required. Vite serves the .wasm file directly when the package is excluded
 * from pre-bundling (see vite.config.ts → optimizeDeps.exclude).
 */
const rapierWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

const runtime = await Runtime.create("canvas", {
  includePerformanceStats: true,
  focusCanvas: false
});

const tileDef = {
  tileSize: 32,
  src: "tileset/UV_cube.png",
  id: "default"
};

const tilesets = await loadTilesets([tileDef]);

const { world } = runtime;
world.logger.setLevel("debug");
world.logger.enableNamespace("*");

const scene = world.sceneManager.getSource();
scene.background = new THREE.Color("#87ceeb");

const dirLight = new THREE.DirectionalLight(new THREE.Color("#ffffff"), 1.5);
dirLight.position.set(16, 32, 20);
scene.add(
  new THREE.AmbientLight(new THREE.Color("#ffffff"), 1.5),
  dirLight
);

/*
 * Every block shares the dirt textures; only the shape changes, so the course
 * exercises each collider strategy: merged cuboids for cubes, sized cuboids
 * for slabs, and a shape-face trimesh for ramps, stairs and poles.
 */
const voxelBlocks: BlockDefinition[] = [
  dirtBlock(kDirtId, "Dirt", "cube"),
  dirtBlock(kSlabId, "Slab", "slabBottom"),
  dirtBlock(kRampId, "Ramp", "ramp"),
  dirtBlock(kStairId, "Stair", "stair"),
  dirtBlock(kPoleId, "Pole", "poleY")
];

function dirtBlock(
  id: number,
  name: string,
  shapeId: BlockDefinition["shapeId"]
): BlockDefinition {
  return {
    id,
    name,
    shapeId,
    collidable: true,
    faceTextures: {
      [Face.PosY]: {
        tilesetId: "default",
        col: 0,
        row: 2
      },
      [Face.NegX]: {
        tilesetId: "default",
        col: 0,
        row: 1
      },
      [Face.NegZ]: {
        tilesetId: "default",
        col: 0,
        row: 1
      },
      [Face.PosX]: {
        tilesetId: "default",
        col: 0,
        row: 1
      },
      [Face.PosZ]: {
        tilesetId: "default",
        col: 0,
        row: 1
      }
    },
    defaultTexture: {
      tilesetId: "default",
      col: 2,
      row: 0
    }
  };
}

/*
 * VoxelRenderer with Rapier physics enabled: RapierVoxelCollider builds box
 * colliders for every collidable chunk during awake() and each dirty rebuild.
 */
const voxelMap = world.createActor("map")
  .addComponentAndGet(
    VoxelRenderer,
    {
      chunkSize: 16,
      layers: ["Ground"],
      blocks: voxelBlocks,
      alphaTest: 0.5,
      material: "lambert",
      // VoxelEngine only sees the VoxelCollider interface; Rapier lives here.
      collider: (context) => new RapierVoxelCollider({
        api: RAPIER,
        world: rapierWorld,
        ...context
      }),
      tilesets
    }
  );

/*
 * ── Flat 32 × 32 ground at y = 0 ─────────────────────────────────────────────
 * Four 16 × 16 chunks; each chunk's cubes are merged into a few cuboids.
 */
for (let x = 0; x < kTerrainSize; x++) {
  for (let z = 0; z < kTerrainSize; z++) {
    voxelMap.engine.world.setVoxel("Ground", { position: { x, y: 0, z }, blockId: 1 });
  }
}

/*
 * ── Raised platform (8 × 8, 2 layers) ────────────────────────────────────────
 * Sits in the centre of the terrain. The sphere drops onto it, then rolls off
 * the edge and continues across the flat ground below.
 */
for (let y = 1; y <= kPlatformHeight; y++) {
  for (let x = kPlatformMin; x <= kPlatformMax; x++) {
    for (let z = kPlatformMin; z <= kPlatformMax; z++) {
      voxelMap.engine.world.setVoxel("Ground", { position: { x, y, z }, blockId: 1 });
    }
  }
}

function place(
  x: number,
  y: number,
  z: number,
  blockId: number,
  rotation = 0
): void {
  voxelMap.engine.world.setVoxel("Ground", {
    position: { x, y, z },
    blockId,
    rotation
  });
}

/*
 * ── Obstacle course ──────────────────────────────────────────────────────────
 * A ramp climbs the platform from the south, stairs from the east, a field of
 * slabs makes bumps to roll over, and pillars plus poles block the way.
 */
for (let x = 14; x <= 17; x++) {
  place(x, 1, 21, kRampId, 2);
  place(x, 1, 20, kDirtId);
  place(x, 2, 20, kRampId, 2);
}

for (let z = 14; z <= 17; z++) {
  place(21, 1, z, kStairId, 1);
  place(20, 1, z, kDirtId);
  place(20, 2, z, kStairId, 1);
}

for (let x = 3; x <= 9; x += 2) {
  for (let z = 22; z <= 28; z += 2) {
    place(x, 1, z, kSlabId);
  }
}

for (const [x, z] of [[4, 4], [27, 4], [27, 27]]) {
  for (let y = 1; y <= 3; y++) {
    place(x, y, z, kDirtId);
  }
}

for (let x = 23; x <= 29; x += 3) {
  place(x, 1, 24, kPoleId);
  place(x, 2, 24, kPoleId);
}

/*
 * ── Sphere physics body ───────────────────────────────────────────────────────
 * Dynamic ball placed above the platform centre.
 * linearDamping is set high enough that the sphere decelerates promptly when
 * the player releases the arrow keys (terminal speed ≈ 3 m/s at force 0.15).
 */
const sphereBodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(15.5, 9, 15.5)
  .setLinearDamping(3.0)
  .setAngularDamping(1.0);

const sphereBody = rapierWorld.createRigidBody(sphereBodyDesc);

rapierWorld.createCollider(
  RAPIER.ColliderDesc.ball(kSphereRadius)
    .setRestitution(0.3)
    .setFriction(0.8),
  sphereBody
);

// ── Three.js sphere visual ────────────────────────────────────────────────────
const sphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(kSphereRadius, 24, 16),
  new THREE.MeshLambertMaterial({ color: 0xff3333 })
);
scene.add(sphereMesh);

world.createActor("camera")
  .addComponent(CameraComponent)
  .addComponent(FollowCamera, {
    target: sphereMesh,
    offset: { x: 0, y: 6, z: 9 }
  });

/*
 * ── Physics integration ───────────────────────────────────────────────────────
 * Step Rapier once per fixed tick (60 Hz), before sceneManager.fixedUpdate().
 * SphereController then reads input, applies its impulse and records the
 * stepped position in its fixedUpdate(); its update() only interpolates the
 * mesh between the last two steps.
 */
world.on("beforeFixedUpdate", (_dt) => {
  rapierWorld.step();
});

// ── Sphere actor with keyboard controller ─────────────────────────────────────
world.createActor("sphere")
  .addComponent(SphereBehavior, { body: sphereBody, mesh: sphereMesh });

const pane = createExamplePane();
pane.hidden = true;
runtime.load({
  skipLoadingScreen: true
}).catch(console.error);
