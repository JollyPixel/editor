// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  emissive,
  mrt
} from "three/tsl";

// Import Internal Dependencies
import { renderFrames } from "./renderFrames.ts";
import { createView } from "../../../helpers/view.ts";
import type { BlockLightFalloff } from "../../../../src/index.ts";

// CONSTANTS
const kTileTexels = 16;
const kCellPixels = 32;
const kFloorLength = 12;
const kFloorId = 1;
const kGlowId = 2;
const kOccluder = { x: 3, y: 2, z: 0 };

export interface BlockLightProbeOptions {
  forceWebGL: boolean;
  material: "lambert" | "standard";
  strength: number;
  output?: "color" | "emissive";
  falloff?: BlockLightFalloff;
  floorMetalness?: number;
  /**
   * Adds a sun and a block that shades floor cells 1 and 2.
   */
  shadowFill?: number;
}

export interface BlockLightProbe {
  emitter: [number, number, number];
  floor: number[];
}

async function atlasImage(): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  canvas.width = kTileTexels * 2;
  canvas.height = kTileTexels;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, kTileTexels, kTileTexels);
  context.fillStyle = "#ff0000";
  context.fillRect(kTileTexels, 0, kTileTexels, kTileTexels);
  const image = new Image();
  image.src = canvas.toDataURL();
  await image.decode();

  return image;
}

function sunOver(
  target: THREE.Vector3Like
): THREE.DirectionalLight {
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(target.x + 10, target.y + 10, target.z + 0.5);
  sun.target.position.set(target.x, target.y, target.z + 0.5);
  sun.target.updateMatrixWorld();
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
    near: 0.5,
    far: 60
  });
  sun.shadow.mapSize.set(1024, 1024);

  return sun;
}

function cellOffset(
  cell: number,
  width: number,
  height: number
): number {
  const row = Math.floor(height / 2);

  return ((row * width) + (cell * kCellPixels) + (kCellPixels / 2)) * 4;
}

export async function renderBlockLightScene(
  options: BlockLightProbeOptions
): Promise<BlockLightProbe> {
  const width = kFloorLength * kCellPixels;
  const height = kCellPixels;
  const renderer = new THREE.WebGPURenderer({
    forceWebGL: options.forceWebGL,
    antialias: false
  });
  renderer.setSize(width, height);
  await renderer.init();
  renderer.toneMapping = THREE.NoToneMapping;
  const target = new THREE.RenderTarget(width, height);
  renderer.setRenderTarget(target);
  if (options.output === "emissive") {
    target.texture.name = "output";
    renderer.setMRT(mrt({ output: emissive }));
  }

  const view = createView({
    chunkSize: 8,
    blocks: [
      {
        id: kFloorId,
        name: "floor",
        shapeId: "cube",
        defaultTexture: { blocksetId: "atlas", col: 0, row: 0 },
        materialGroup: options.floorMetalness === undefined ? undefined : "floor"
      },
      {
        id: kGlowId,
        name: "glow",
        shapeId: "cube",
        defaultTexture: { blocksetId: "atlas", col: 1, row: 0 },
        materialGroup: "glow"
      }
    ],
    materialGroups: [
      { id: "glow", emissive: "#ffffff", lightLevel: 15 },
      { id: "floor", metalness: options.floorMetalness ?? 0, roughness: 0.85 }
    ],
    rendering: { material: options.material },
    lighting: {
      blockLight: options.strength,
      blockLightFalloff: options.falloff,
      shadowFill: options.shadowFill,
      castShadow: options.shadowFill !== undefined,
      receiveShadow: options.shadowFill !== undefined
    }
  });
  view.loadBlockset(
    { id: "atlas", src: "", tileSize: kTileTexels },
    new THREE.Texture(await atlasImage())
  );
  view.atlases.atlas("atlas").texture.needsUpdate = true;
  const layer = view.document.world.addLayer("ground");
  for (let x = 0; x < kFloorLength; x++) {
    layer.setVoxelAt({ x, y: 0, z: 0 }, { blockId: kFloorId, transform: 0 });
  }
  layer.setVoxelAt({ x: 0, y: 1, z: 0 }, { blockId: kGlowId, transform: 0 });
  if (options.shadowFill !== undefined) {
    layer.setVoxelAt(kOccluder, { blockId: kFloorId, transform: 0 });
  }
  view.flush();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.add(view.root);
  if (options.shadowFill !== undefined) {
    renderer.shadowMap.enabled = true;
    scene.add(sunOver(kOccluder));
  }
  const camera = new THREE.OrthographicCamera(
    -kFloorLength / 2,
    kFloorLength / 2,
    0.5,
    -0.5,
    0.1,
    100
  );
  camera.up.set(0, 0, -1);
  camera.position.set(kFloorLength / 2, 10, 0.5);
  camera.lookAt(kFloorLength / 2, 0, 0.5);
  camera.updateMatrixWorld();

  try {
    await renderFrames(renderer, 2, () => renderer.render(scene, camera));
    const pixels = await renderer.readRenderTargetPixelsAsync(
      target,
      0,
      0,
      width,
      height
    ) as Uint8Array;
    const emitter = cellOffset(0, width, height);

    return {
      emitter: [pixels[emitter], pixels[emitter + 1], pixels[emitter + 2]],
      floor: Array.from(
        { length: kFloorLength },
        (_, cell) => pixels[cellOffset(cell, width, height)]
      )
    };
  }
  finally {
    view.dispose();
    target.dispose();
    renderer.dispose();
  }
}
