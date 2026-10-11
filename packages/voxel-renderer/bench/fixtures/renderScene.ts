// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  emissive,
  mrt,
  output
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

// Import Internal Dependencies
import { VoxelDocument } from "../../src/document/VoxelDocument.ts";
import { VoxelView } from "../../src/view/VoxelView.ts";
import { voxelTransparencyPass } from "../../src/view/postprocess/VoxelTransparencyPassNode.ts";
import type { BlockDefinition } from "../../src/document/blocks/BlockDefinition.ts";
import { renderFrames } from "../../test/view/gpu/fixtures/renderFrames.ts";

// CONSTANTS
const kTileTexels = 16;
const kGroundId = 1;
const kGlowId = 2;
const kGlassId = 3;
const kWarmupFrames = 5;

export interface RenderBenchOptions {
  forceWebGL: boolean;
  size: number;
  lights: number;
  frames: number;
  resolution: number;
  glow: boolean;
  glass: boolean;
  blockLight: number;
}

function block(
  id: number,
  col: number,
  extra: Partial<BlockDefinition> = {}
): BlockDefinition {
  return {
    id,
    name: `block ${id}`,
    shapeId: "cube",
    faceTextures: {},
    defaultTexture: { blocksetId: "atlas", col, row: 0 },
    collidable: true,
    properties: {},
    ...extra
  };
}

function unthrottleFrames(): void {
  const channel = new MessageChannel();
  const pending = new Map<number, FrameRequestCallback>();
  let next = 0;
  channel.port1.onmessage = (event: MessageEvent<number>) => {
    const callback = pending.get(event.data);
    pending.delete(event.data);
    callback?.(performance.now());
  };
  window.requestAnimationFrame = (callback) => {
    next++;
    pending.set(next, callback);
    channel.port2.postMessage(next);

    return next;
  };
  window.cancelAnimationFrame = (id) => {
    pending.delete(id);
  };
}

function atlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = kTileTexels * 3;
  canvas.height = kTileTexels;
  const context = canvas.getContext("2d")!;
  for (const [index, fill] of ["#7a9a5a", "#ffd080", "#80c0ff"].entries()) {
    context.fillStyle = fill;
    context.fillRect(index * kTileTexels, 0, kTileTexels, kTileTexels);
  }
  context.fillStyle = "rgba(0, 0, 0, 0.25)";
  context.fillRect(0, 0, kTileTexels / 2, kTileTexels / 2);

  return canvas;
}

function buildView(
  options: RenderBenchOptions
): VoxelView {
  const document = new VoxelDocument({
    chunkSize: 16,
    layers: ["Ground"],
    blocks: [
      block(kGroundId, 0),
      block(kGlowId, 1, { materialGroup: "glow" }),
      block(kGlassId, 2, { alphaMode: "blend" })
    ],
    materialGroups: [
      { id: "glow", emissive: "#ffb050", lightLevel: 15 }
    ]
  });
  const view = new VoxelView(document, {
    rendering: { material: "lambert" },
    lighting: { blockLight: options.blockLight }
  });
  const texture = new THREE.Texture(atlasCanvas());
  texture.colorSpace = THREE.SRGBColorSpace;
  view.loadBlockset({ id: "atlas", src: "", tileSize: kTileTexels }, texture);
  view.atlases.requireLoadedAtlas("atlas").texture.needsUpdate = true;

  const cells: number[] = [];
  const { size } = options;
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const height = 1 + (((x * 7) + (z * 13)) % 4);
      for (let y = 0; y < height; y++) {
        cells.push(x, y, z, kGroundId, 0);
      }
      if (options.glass && (x + z) % 9 === 0) {
        cells.push(x, height, z, kGlassId, 0);
      }
    }
  }
  const step = Math.max(1, Math.floor((size * size) / Math.max(1, options.lights)));
  for (let i = 0; i < options.lights; i++) {
    const cell = (i * step) % (size * size);
    cells.push(Math.floor(cell / size), 5, cell % size, kGlowId, 0);
  }
  document.world.patchVoxels("Ground", cells);
  view.flush();

  return view;
}

function pipelineOf(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  glow: boolean
): THREE.RenderPipeline {
  const pass = voxelTransparencyPass(scene, camera, { samples: 4 });
  if (!glow) {
    return new THREE.RenderPipeline(renderer, pass);
  }

  pass.setMRT(mrt({
    output,
    emissive
  }));

  return new THREE.RenderPipeline(
    renderer,
    pass.add(bloom(pass.getTextureNode("emissive"), 0.6, 0.2))
  );
}

export async function renderBench(
  options: RenderBenchOptions
): Promise<number> {
  const { resolution } = options;
  unthrottleFrames();
  const renderer = new THREE.WebGPURenderer({
    forceWebGL: options.forceWebGL,
    antialias: false
  });
  renderer.setSize(resolution, resolution);
  await renderer.init();
  const target = new THREE.RenderTarget(resolution, resolution);
  renderer.setRenderTarget(target);

  const view = buildView(options);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101020);
  scene.add(view.root, new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(1, 2, 1);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  const { size } = options;
  camera.position.set(size / 2, size * 0.6, size * 1.1);
  camera.lookAt(size / 2, 0, size / 2);
  camera.updateMatrixWorld();

  const pipeline = pipelineOf(renderer, scene, camera, options.glow);
  pipeline.outputColorTransform = false;
  try {
    await renderFrames(renderer, kWarmupFrames, () => pipeline.render());
    await renderer.readRenderTargetPixelsAsync(target, 0, 0, 1, 1);

    const start = performance.now();
    await renderFrames(renderer, options.frames, () => pipeline.render());
    await renderer.readRenderTargetPixelsAsync(target, 0, 0, 1, 1);

    return (performance.now() - start) / options.frames;
  }
  finally {
    view.dispose();
    pipeline.dispose();
    target.dispose();
    renderer.dispose();
  }
}
