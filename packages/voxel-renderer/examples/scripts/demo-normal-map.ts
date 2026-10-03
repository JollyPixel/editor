// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  VoxelDocument,
  VoxelView,
  type VoxelWorld
} from "../../src/index.ts";
import {
  type LabelEntry,
  createLabel,
  createOrbitCamera,
  createRenderer,
  createScene,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";
import {
  RELIEF_GROUP,
  ReliefBlock,
  createReliefTileset
} from "./utils/reliefAtlas.ts";

// CONSTANTS
const kLayer = "Ground";
const kSize = 14;
const kCenter = kSize / 2;
const kSunRadius = 24;

const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

const tileset = createReliefTileset();
const loader = new THREE.TextureLoader();
const [albedo, normal] = await Promise.all([
  loader.loadAsync(tileset.albedoSrc),
  loader.loadAsync(tileset.normalSrc)
]);

const finish = {
  normalScale: 1,
  roughness: 0.8
};

const voxelDocument = new VoxelDocument({
  chunkSize: 16,
  layers: [kLayer],
  blocks: tileset.blocks,
  materialGroups: [
    {
      id: RELIEF_GROUP,
      ...finish
    }
  ]
});
const voxels = new VoxelView(voxelDocument);
voxels.loadTileset(tileset.definition, albedo, { normal });

buildDiorama(voxelDocument.world);
voxels.init();

const renderer = createRenderer(canvas);
const scene = createScene("#20242c");
const { camera, controls } = createOrbitCamera(
  canvas,
  { x: kCenter, y: 9, z: kCenter + 13 },
  { x: kCenter, y: 1.5, z: kCenter }
);
scene.add(voxels.root);

const ambient = new THREE.AmbientLight("#b8c8ff", 0.5);
const sun = new THREE.DirectionalLight("#fff1d6", 3);
sun.target.position.set(kCenter, 0, kCenter);
scene.add(ambient, sun, sun.target);

const labelEntries: LabelEntry[] = [
  createLabel("bricks", new THREE.Vector3(3, 4.6, 2)),
  createLabel("planks", new THREE.Vector3(10, 4.6, 2)),
  createLabel("ramps · stairs", new THREE.Vector3(kCenter, 2.6, 7)),
  createLabel("studs", new THREE.Vector3(11, 2.4, 11))
];

const lightState = {
  azimuth: 30,
  elevation: 25,
  spin: true,
  sun: sun.intensity,
  ambient: ambient.intensity
};

const pane = createExamplePane({ title: "Normal Map" });

const reliefFolder = pane.addFolder({ title: "Relief" });
reliefFolder
  .addBinding(finish, "normalScale", {
    label: "normal scale",
    min: 0,
    max: 4,
    step: 0.05
  })
  .on("change", defineFinish);
reliefFolder
  .addBinding(finish, "roughness", {
    label: "roughness",
    min: 0,
    max: 1,
    step: 0.01
  })
  .on("change", defineFinish);

const lightFolder = pane.addFolder({ title: "Light" });
lightFolder
  .addBinding(lightState, "azimuth", { min: 0, max: 360, step: 1 })
  .on("change", updateSun);
lightFolder
  .addBinding(lightState, "elevation", { min: 5, max: 90, step: 1 })
  .on("change", updateSun);
lightFolder.addBinding(lightState, "spin");
lightFolder
  .addBinding(lightState, "sun", { min: 0, max: 6, step: 0.05 })
  .on("change", ({ value }) => (sun.intensity = value));
lightFolder
  .addBinding(lightState, "ambient", { min: 0, max: 3, step: 0.05 })
  .on("change", ({ value }) => (ambient.intensity = value));

updateSun();

let lastTime = performance.now();

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
      lightState.azimuth = (lightState.azimuth + (deltaTime * 25)) % 360;
      updateSun();
      pane.refresh();
    }

    voxels.tick(deltaTime);
  }
});

function defineFinish(): void {
  voxelDocument.defineMaterialGroup({
    id: RELIEF_GROUP,
    ...finish
  });
}

function updateSun(): void {
  const azimuth = THREE.MathUtils.degToRad(lightState.azimuth);
  const elevation = THREE.MathUtils.degToRad(lightState.elevation);
  const horizontal = Math.cos(elevation) * kSunRadius;

  sun.position.set(
    kCenter + (Math.cos(azimuth) * horizontal),
    Math.sin(elevation) * kSunRadius,
    kCenter + (Math.sin(azimuth) * horizontal)
  );
}

function buildDiorama(
  world: VoxelWorld
): void {
  for (let x = 0; x < kSize; x++) {
    for (let z = 0; z < kSize; z++) {
      place(world, x, 0, z, ReliefBlock.Cobble);
    }
  }

  for (let x = 1; x < kSize - 1; x++) {
    for (let y = 1; y <= 3; y++) {
      place(world, x, y, 1, x < kCenter ? ReliefBlock.Bricks : ReliefBlock.Planks);
    }
  }

  for (let x = 2; x < kSize - 2; x++) {
    place(world, x, 1, 5, x < kCenter ? ReliefBlock.BrickRamp : ReliefBlock.PlankStair);
    place(world, x, 1, 7, ReliefBlock.CobbleSlab);
  }

  for (let x = 9; x <= 12; x++) {
    for (let z = 9; z <= 12; z++) {
      place(world, x, 1, z, ReliefBlock.Studs);
    }
  }

  for (const [x, z] of [[2, 10], [4, 12], [6, 10]]) {
    for (let y = 1; y <= 2; y++) {
      place(world, x, y, z, ReliefBlock.StudPole);
    }
  }
}

function place(
  world: VoxelWorld,
  x: number,
  y: number,
  z: number,
  blockId: number
): void {
  world.setVoxel(kLayer, {
    position: { x, y, z },
    blockId
  });
}
