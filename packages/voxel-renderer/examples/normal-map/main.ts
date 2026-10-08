// Import Third-party Dependencies
import * as THREE from "three";
import {
  VoxelDocument,
  VoxelView,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { createExamplePane } from "../shared/example-pane.ts";
import { OrbitViewer } from "../shared/OrbitViewer.ts";
import { fillBox } from "../shared/voxelBox.ts";
import {
  RELIEF_GROUP,
  ReliefBlock,
  createReliefBlockset
} from "./reliefAtlas.ts";

// CONSTANTS
const kLayer = "Ground";
const kSize = 14;
const kCenter = kSize / 2;
const kSunRadius = 24;

const blockset = createReliefBlockset();
const loader = new THREE.TextureLoader();
const [albedo, normal] = await Promise.all([
  loader.loadAsync(blockset.albedoSrc),
  loader.loadAsync(blockset.normalSrc)
]);

const finish = {
  normalScale: 1,
  roughness: 0.8
};

const voxelDocument = new VoxelDocument({
  chunkSize: 16,
  layers: [kLayer],
  blocks: blockset.blocks,
  materialGroups: [
    {
      id: RELIEF_GROUP,
      ...finish
    }
  ]
});
const voxels = new VoxelView(voxelDocument);
voxels.loadBlockset(blockset.definition, albedo, { normal });

buildDiorama(voxelDocument.world);
voxels.init();

const viewer = new OrbitViewer({
  position: { x: kCenter, y: 9, z: kCenter + 13 },
  target: { x: kCenter, y: 1.5, z: kCenter },
  background: "#20242c"
});

const ambient = new THREE.AmbientLight("#b8c8ff", 0.5);
const sun = new THREE.DirectionalLight("#fff1d6", 3);
sun.target.position.set(kCenter, 0, kCenter);
viewer.scene.add(voxels.root, ambient, sun, sun.target);

viewer.label("bricks", { x: 3, y: 4.6, z: 2 });
viewer.label("planks", { x: 10, y: 4.6, z: 2 });
viewer.label("ramps · stairs", { x: kCenter, y: 2.6, z: 7 });
viewer.label("studs", { x: 11, y: 2.4, z: 11 });

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

await viewer.start({
  onFrame: (deltaTime) => {
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
  fillBox(world, kLayer, ReliefBlock.Cobble, {
    x0: 0,
    x1: kSize - 1,
    y0: 0,
    y1: 0,
    z0: 0,
    z1: kSize - 1
  });
  fillBox(world, kLayer, ReliefBlock.Bricks, {
    x0: 1,
    x1: kCenter - 1,
    y0: 1,
    y1: 3,
    z0: 1,
    z1: 1
  });
  fillBox(world, kLayer, ReliefBlock.Planks, {
    x0: kCenter,
    x1: kSize - 2,
    y0: 1,
    y1: 3,
    z0: 1,
    z1: 1
  });

  for (let x = 2; x < kSize - 2; x++) {
    world.setVoxel(kLayer, {
      position: { x, y: 1, z: 5 },
      blockId: x < kCenter ? ReliefBlock.BrickRamp : ReliefBlock.PlankStair
    });
  }
  fillBox(world, kLayer, ReliefBlock.CobbleSlab, {
    x0: 2,
    x1: kSize - 3,
    y0: 1,
    y1: 1,
    z0: 7,
    z1: 7
  });

  fillBox(world, kLayer, ReliefBlock.Studs, {
    x0: 9,
    x1: 12,
    y0: 1,
    y1: 1,
    z0: 9,
    z1: 12
  });
  for (const [x, z] of [[2, 10], [4, 12], [6, 10]]) {
    fillBox(world, kLayer, ReliefBlock.StudPole, {
      x0: x,
      x1: x,
      y0: 1,
      y1: 2,
      z0: z,
      z1: z
    });
  }
}
