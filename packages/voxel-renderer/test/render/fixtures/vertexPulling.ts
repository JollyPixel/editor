// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  mrt,
  output,
  velocity
} from "three/tsl";

// Import Internal Dependencies
import { VoxelEngine } from "../../../src/VoxelEngine.ts";
import type { BlockShapeID } from "../../../src/blocks/shape/BlockShape.ts";
import { PulledChunkMesh } from "../../../src/mesh/pulling/PulledChunkMesh.ts";

// CONSTANTS
const kSize = 64;
const kAtlasTexels = 8;
const kShapes: BlockShapeID[] = [
  "cube",
  "slabBottom",
  "slabTop",
  "poleY",
  "pole",
  "ramp",
  "rampCornerInner",
  "rampCornerOuter",
  "stair",
  "stairCornerInner",
  "stairCornerOuter"
];

export interface ParityOptions {
  forceWebGL: boolean;
  vertexPulling: boolean;
  ambientOcclusion?: number;
  far?: boolean;
  shadows?: boolean;
  /**
   * Reads the motion vectors of a camera move instead of the colours, in
   * quarter pixels.
   */
  velocity?: boolean;
}

function renderFrames(
  renderer: THREE.WebGPURenderer,
  frames: number,
  draw: () => void
): Promise<void> {
  return new Promise((resolve) => {
    let remaining = frames;
    void renderer.setAnimationLoop(() => {
      draw();
      remaining--;
      if (remaining === 0) {
        void renderer.setAnimationLoop(null);
        resolve();
      }
    });
  });
}

async function atlasImage(): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  canvas.width = kAtlasTexels;
  canvas.height = kAtlasTexels;
  const context = canvas.getContext("2d")!;
  for (let y = 0; y < kAtlasTexels; y++) {
    for (let x = 0; x < kAtlasTexels; x++) {
      const seed = (x * 37) + (y * 91);
      context.fillStyle = `rgb(${(seed * 53) % 256}, ${(seed * 97) % 256}, ${(seed * 29) % 256})`;
      context.fillRect(x, y, 1, 1);
    }
  }
  const image = new Image();
  image.src = canvas.toDataURL();
  await image.decode();

  return image;
}

export async function renderParityScene(
  options: ParityOptions
): Promise<number[]> {
  const renderer = new THREE.WebGPURenderer({
    forceWebGL: options.forceWebGL,
    antialias: false
  });
  renderer.setSize(kSize, kSize);
  await renderer.init();
  if (!options.forceWebGL && !("isWebGPUBackend" in renderer.backend)) {
    renderer.dispose();
    throw new Error("The native WebGPU probe fell back to WebGL.");
  }
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = options.shadows ?? false;
  const target = options.velocity ?
    velocityTarget(renderer) :
    new THREE.RenderTarget(kSize, kSize);
  renderer.setRenderTarget(target);

  const engine = new VoxelEngine({
    chunkSize: 8,
    vertexPulling: options.vertexPulling,
    ambientOcclusion: options.ambientOcclusion ?? 0,
    farDistance: options.far ? 0 : Infinity,
    castShadow: options.shadows ?? false,
    receiveShadow: options.shadows ?? false,
    blocks: kShapes.map((shapeId, index) => {
      return {
        id: index + 1,
        name: shapeId,
        shapeId,
        defaultTexture: {
          tilesetId: "atlas",
          col: index % 4,
          row: Math.floor(index / 4)
        }
      };
    })
  });
  engine.loadTileset(
    { id: "atlas", src: "", tileSize: 2 },
    new THREE.Texture(await atlasImage())
  );
  engine.tilesetManager.atlas("atlas").texture.needsUpdate = true;
  const layer = engine.world.addLayer("parity");
  for (let x = 0; x < 6; x++) {
    for (let z = 0; z < 6; z++) {
      layer.setVoxelAt({ x, y: 0, z }, { blockId: 1, transform: 0 });
    }
  }
  kShapes.forEach((_, index) => {
    layer.setVoxelAt({
      x: index % 4,
      y: 1,
      z: Math.floor(index / 4) * 2
    }, {
      blockId: index + 1,
      transform: (index * 5) % 24
    });
  });
  layer.setVoxelAt({ x: 1, y: 2, z: 0 }, { blockId: 1, transform: 0 });
  if (options.shadows) {
    for (let x = 1; x < 4; x++) {
      for (let z = 1; z < 4; z++) {
        layer.setVoxelAt({ x, y: 4, z }, { blockId: 1, transform: 0 });
      }
    }
  }
  if (options.far) {
    engine.focus = { x: 100, y: 100, z: 100 };
  }
  engine.flush();

  const chunks = engine.root.getObjectByName("VoxelView:chunks")!;
  const pulled = chunks.children.every((child) => child instanceof PulledChunkMesh);
  if (pulled !== options.vertexPulling) {
    throw new Error("The chunk meshes do not match the requested vertex pulling mode.");
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x102030);
  const directional = new THREE.DirectionalLight(0xffffff, 2);
  directional.position.set(3, 8, 5);
  directional.castShadow = options.shadows ?? false;
  directional.shadow.camera.left = -8;
  directional.shadow.camera.right = 8;
  directional.shadow.camera.top = 8;
  directional.shadow.camera.bottom = -8;
  scene.add(
    engine.root,
    new THREE.AmbientLight(0xffffff, 0.8),
    directional
  );
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(9, 7, 10);
  camera.lookAt(2.5, 1, 2.5);
  camera.updateMatrixWorld();

  try {
    let frame = 0;
    await renderFrames(renderer, 3, () => {
      frame++;
      if (options.velocity && frame === 3) {
        camera.position.set(8, 7.5, 11);
        camera.lookAt(2.5, 1, 2.5);
        camera.updateMatrixWorld();
      }
      renderer.render(scene, camera);
    });
    if (options.velocity) {
      const halves = await renderer.readRenderTargetPixelsAsync(
        target, 0, 0, kSize, kSize, 1
      );

      return Array.from(
        halves as Uint16Array,
        (half) => Math.round(THREE.DataUtils.fromHalfFloat(half) * kSize * 2)
      );
    }
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, kSize, kSize);

    return Array.from(pixels);
  }
  finally {
    engine.dispose();
    target.dispose();
    renderer.dispose();
  }
}

function velocityTarget(
  renderer: THREE.WebGPURenderer
): THREE.RenderTarget {
  const target = new THREE.RenderTarget(kSize, kSize, {
    count: 2,
    type: THREE.HalfFloatType
  });
  target.textures[0].name = "output";
  target.textures[1].name = "velocity";
  renderer.setMRT(mrt({
    output,
    velocity
  }));

  return target;
}
