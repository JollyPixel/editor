// Import Third-party Dependencies
import RAPIER from "@dimforge/rapier3d";
import {
  Camera3DControls
} from "@jolly-pixel/engine";
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import {
  VoxelRenderer,
  Face,
  type BlockDefinition
} from "../../src/index.ts";
import { SphereBehavior } from "./components/SphereController.ts";
import { createExamplesMenu } from "./utils/menu.ts";

// CONSTANTS
const kTerrainSize = 32;
const kPlatformMin = 12;
const kPlatformMax = 19;
const kPlatformHeight = 2;
const kSphereRadius = 0.5;

const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

// @dimforge/rapier3d 0.19.x loads its WASM binary via a static bundler import
// (`import * as wasm from "./rapier_wasm3d_bg.wasm"`) — no explicit init() call
// is required. Vite serves the .wasm file directly when the package is excluded
// from pre-bundling (see vite.config.ts → optimizeDeps.exclude).
const rapierWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

const runtime = new Runtime(canvas, {
  includePerformanceStats: true
});

const { world } = runtime;

const scene = world.sceneManager.getSource();
scene.background = new THREE.Color("#87ceeb");

const dirLight = new THREE.DirectionalLight(new THREE.Color("#ffffff"), 1.5);
dirLight.position.set(16, 32, 20);
scene.add(
  new THREE.AmbientLight(new THREE.Color("#ffffff"), 1.5),
  dirLight
);

world.createActor("camera")
  .addComponent(Camera3DControls, { speed: 0.35, rotationSpeed: 0.50 }, (component) => {
    component.camera.position.set(16, 22, 50);
    component.camera.lookAt(16, 1, 16);
  });

// One block type — collidable fullCube so VoxelColliderBuilder creates box
// colliders for every voxel (compound cuboid strategy, one per solid block).
const voxelBlocks: BlockDefinition[] = [
  {
    id: 1,
    name: "Dirt",
    shapeId: "cube",
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
  }
];

// VoxelRenderer with Rapier physics enabled.
// The VoxelColliderBuilder will automatically build box colliders for every
// collidable voxel chunk during awake() and on each subsequent dirty rebuild.
const voxelMap = world.createActor("map")
  .addComponentAndGet(
    VoxelRenderer,
    {
      chunkSize: 16,
      layers: ["Ground"],
      blocks: voxelBlocks,
      alphaTest: 0.5,
      material: "lambert",
      rapier: {
        // RapierAPI and RapierWorld are structural interfaces, so the real
        // Rapier namespace / World instance satisfy them without any cast.
        api: RAPIER as never,
        world: rapierWorld as never
      }
    }
  );

// ── Flat 32 × 32 ground at y = 0 ─────────────────────────────────────────────
// Four 16 × 16 chunks, each getting a compound-cuboid collider built from the
// 16 × 16 = 256 individual voxels (box colliders, most performant strategy).
for (let x = 0; x < kTerrainSize; x++) {
  for (let z = 0; z < kTerrainSize; z++) {
    voxelMap.setVoxel("Ground", { position: { x, y: 0, z }, blockId: 1 });
  }
}

// ── Raised platform (8 × 8, 2 layers) ────────────────────────────────────────
// Sits in the centre of the terrain. The sphere drops onto it, then rolls off
// the edge and continues across the flat ground below.
for (let y = 1; y <= kPlatformHeight; y++) {
  for (let x = kPlatformMin; x <= kPlatformMax; x++) {
    for (let z = kPlatformMin; z <= kPlatformMax; z++) {
      voxelMap.setVoxel("Ground", { position: { x, y, z }, blockId: 1 });
    }
  }
}

// ── Sphere physics body ───────────────────────────────────────────────────────
// Dynamic ball placed above the platform centre.
// linearDamping is set high enough that the sphere decelerates promptly when
// the player releases the arrow keys (terminal speed ≈ 3 m/s at force 0.15).
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

// ── Physics integration ───────────────────────────────────────────────────────
// Step Rapier once per fixed tick (60 Hz), before sceneManager.fixedUpdate().
// SphereController.update() handles input, impulse application, and mesh sync.
world.on("beforeFixedUpdate", (_dt) => {
  rapierWorld.step();
});

// ── Sphere actor with keyboard controller ─────────────────────────────────────
world.createActor("sphere")
  .addComponent(SphereBehavior, { body: sphereBody, mesh: sphereMesh });

// ── Tileset + runtime start ───────────────────────────────────────────────────
voxelMap.loadTileset({
  tileSize: 32,
  src: "tileset/UV_cube.png",
  id: "default"
}).catch(console.error);

createExamplesMenu();
loadRuntime(runtime).catch(console.error);
