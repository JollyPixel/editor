// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { renderFrames } from "./renderFrames.ts";
import { createView } from "../../../helpers/view.ts";
import { PulledChunkMesh } from "../../../../src/view/meshing/pulling/PulledChunkMesh.ts";
import type { BlendGroupJSON } from "../../../../src/document/materials/BlendGroup.ts";

// CONSTANTS
const kTileTexels = 16;
const kCellPixels = 32;
const kColumns = 4;
const kRows = 2;
const kGrassId = 1;
const kDirtId = 2;

export interface BlendProbeOptions {
  forceWebGL: boolean;
  groups: [grass: string, dirt: string];
  blendGroups: BlendGroupJSON[];
}

export interface BlendProbe {
  width: number;
  height: number;
  pixels: number[];
}

async function atlasImage(): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  canvas.width = kTileTexels * 2;
  canvas.height = kTileTexels;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ff0000";
  context.fillRect(0, 0, kTileTexels, kTileTexels);
  context.fillStyle = "#0000ff";
  context.fillRect(kTileTexels, 0, kTileTexels, kTileTexels);
  const image = new Image();
  image.src = canvas.toDataURL();
  await image.decode();

  return image;
}

/**
 * Draws two red grass columns beside two blue dirt columns from above.
 */
export async function renderBlendScene(
  options: BlendProbeOptions
): Promise<BlendProbe> {
  const width = kColumns * kCellPixels;
  const height = kRows * kCellPixels;
  const renderer = new THREE.WebGPURenderer({
    forceWebGL: options.forceWebGL,
    antialias: false
  });
  renderer.setSize(width, height);
  await renderer.init();
  renderer.toneMapping = THREE.NoToneMapping;
  const target = new THREE.RenderTarget(width, height);
  renderer.setRenderTarget(target);

  const view = createView({
    chunkSize: 8,
    blocks: [kGrassId, kDirtId].map((id, index) => {
      return {
        id,
        name: options.groups[index],
        shapeId: "cube",
        defaultTexture: { blocksetId: "atlas", col: index, row: 0 },
        blendGroup: options.groups[index]
      };
    }),
    blendGroups: options.blendGroups
  });
  view.loadBlockset(
    { id: "atlas", src: "", tileSize: kTileTexels },
    new THREE.Texture(await atlasImage())
  );
  view.atlases.atlas("atlas").texture.needsUpdate = true;
  const layer = view.document.world.addLayer("ground");
  for (let x = 0; x < kColumns; x++) {
    for (let z = 0; z < kRows; z++) {
      layer.setVoxelAt({ x, y: 0, z }, {
        blockId: x < kColumns / 2 ? kGrassId : kDirtId,
        transform: 0
      });
    }
  }
  view.flush();
  const chunks = view.root.getObjectByName("VoxelView:chunks")!;
  if (!chunks.children.every((child) => child instanceof PulledChunkMesh)) {
    throw new Error("The chunk meshes are not vertex pulled.");
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.add(view.root, new THREE.AmbientLight(0xffffff, 1));
  const camera = new THREE.OrthographicCamera(
    -kColumns / 2,
    kColumns / 2,
    kRows / 2,
    -kRows / 2,
    0.1,
    100
  );
  camera.position.set(kColumns / 2, 10, kRows / 2);
  camera.up.set(0, 0, -1);
  camera.lookAt(kColumns / 2, 0, kRows / 2);
  camera.updateMatrixWorld();

  try {
    await renderFrames(renderer, 2, () => renderer.render(scene, camera));
    const pixels = await renderer.readRenderTargetPixelsAsync(
      target,
      0,
      0,
      width,
      height
    );

    return {
      width,
      height,
      pixels: Array.from(pixels as Uint8Array)
    };
  }
  finally {
    view.dispose();
    target.dispose();
    renderer.dispose();
  }
}
