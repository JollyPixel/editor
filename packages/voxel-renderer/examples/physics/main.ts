// Import Third-party Dependencies
import RAPIER from "@dimforge/rapier3d";
import {
  CameraComponent
} from "@jolly-pixel/engine";
import {
  Face,
  loadBlocksets,
  RapierVoxelCollider,
  type BlockDefinition,
  type TileRef
} from "@jolly-pixel/voxel.renderer";
import {
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer/engine";
import { Runtime } from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import { createExamplePane } from "../shared/example-pane.ts";
import { fillBox } from "../shared/voxelBox.ts";
import { FollowCamera } from "./FollowCamera.ts";
import { SphereBehavior } from "./SphereBehavior.ts";

// CONSTANTS
const kLayer = "Ground";
const kBlocksetId = "default";
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
const kTopTile: TileRef = {
  blocksetId: kBlocksetId,
  col: 0,
  row: 2
};
const kSideTile: TileRef = {
  blocksetId: kBlocksetId,
  col: 0,
  row: 1
};
const kBottomTile: TileRef = {
  blocksetId: kBlocksetId,
  col: 2,
  row: 0
};

const rapierWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

const runtime = await Runtime.create("canvas", {
  includePerformanceStats: true,
  focusCanvas: false
});

const blocksets = await loadBlocksets([
  {
    id: kBlocksetId,
    src: "/blockset/UV_cube.png",
    tileSize: 32
  }
]);

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
      [Face.PosY]: kTopTile,
      [Face.NegX]: kSideTile,
      [Face.NegZ]: kSideTile,
      [Face.PosX]: kSideTile,
      [Face.PosZ]: kSideTile
    },
    defaultTexture: kBottomTile
  };
}

const voxelMap = world.createActor("map")
  .addComponentAndGet(
    VoxelRenderer,
    {
      document: {
        chunkSize: 16,
        layers: [kLayer],
        blocks: voxelBlocks
      },
      rendering: {
        alphaTest: 0.5,
        material: "lambert"
      },
      collider: (context) => new RapierVoxelCollider({
        api: RAPIER,
        world: rapierWorld,
        ...context
      }),
      blocksets
    }
  );

const voxelWorld = voxelMap.document.world;
fillBox(voxelWorld, kLayer, kDirtId, {
  x0: 0,
  x1: kTerrainSize - 1,
  y0: 0,
  y1: 0,
  z0: 0,
  z1: kTerrainSize - 1
});
fillBox(voxelWorld, kLayer, kDirtId, {
  x0: kPlatformMin,
  x1: kPlatformMax,
  y0: 1,
  y1: kPlatformHeight,
  z0: kPlatformMin,
  z1: kPlatformMax
});

function place(
  x: number,
  y: number,
  z: number,
  blockId: number,
  rotation = 0
): void {
  voxelWorld.setVoxel(kLayer, {
    position: { x, y, z },
    blockId,
    rotation
  });
}

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
  fillBox(voxelWorld, kLayer, kDirtId, {
    x0: x,
    x1: x,
    y0: 1,
    y1: 3,
    z0: z,
    z1: z
  });
}

for (let x = 23; x <= 29; x += 3) {
  place(x, 1, 24, kPoleId);
  place(x, 2, 24, kPoleId);
}

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

world.on("beforeFixedUpdate", (_dt) => {
  rapierWorld.step();
});

world.createActor("sphere")
  .addComponent(SphereBehavior, { body: sphereBody, mesh: sphereMesh });

const pane = createExamplePane();
pane.hidden = true;
runtime.load({
  skipLoadingScreen: true
}).catch(console.error);
