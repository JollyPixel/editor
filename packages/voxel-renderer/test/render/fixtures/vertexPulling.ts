// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  attribute,
  float,
  mrt,
  normalWorld,
  output,
  uv,
  vec4,
  velocity
} from "three/tsl";

// Import Internal Dependencies
import { VoxelEngine } from "../../../src/VoxelEngine.ts";
import type { BlockShapeID } from "../../../src/blocks/shape/BlockShape.ts";
import {
  enableVertexPulling,
  PulledChunkGeometry,
  PulledChunkMesh
} from "../../../src/mesh/index.ts";
import { expandPulled } from "../../helpers/pulledFaces.ts";

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

export type ParityChannel =
  | "uv"
  | "normal"
  | "shade"
  | "lit"
  | "velocity";

export interface ParityOptions {
  forceWebGL: boolean;
  expanded: boolean;
  channel: ParityChannel;
  ambientOcclusion?: boolean;
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
  const image = new Image();
  image.src = canvas.toDataURL();
  await image.decode();

  return image;
}

function probeMaterial(
  channel: ParityChannel,
  pulled: PulledChunkGeometry | null
): THREE.NodeMaterial {
  const material = channel === "lit" ?
    new THREE.MeshLambertNodeMaterial() :
    new THREE.MeshBasicNodeMaterial();
  const inputs = pulled === null ?
    { uv: uv(), brightness: attribute<"vec4">("normal", "vec4").w } :
    enableVertexPulling(material, pulled.templates);

  if (channel === "uv") {
    material.colorNode = vec4(inputs.uv, float(0), float(1));
  }
  else if (channel === "normal") {
    material.colorNode = vec4(normalWorld.mul(0.5).add(0.5), float(1));
  }
  else if (channel === "shade") {
    material.colorNode = vec4(inputs.brightness, inputs.brightness, inputs.brightness, float(1));
  }
  else {
    material.colorNode = vec4(float(1));
  }

  return material;
}

function swapProbeMeshes(
  chunks: THREE.Object3D,
  options: ParityOptions
): THREE.Group {
  const probes = new THREE.Group();
  for (const child of chunks.children) {
    if (!(child instanceof PulledChunkMesh)) {
      throw new Error("The chunk meshes are not vertex pulled.");
    }

    const { geometry } = child;
    const mesh = options.expanded ?
      new THREE.Mesh(expandPulled(geometry), probeMaterial(options.channel, null)) :
      new PulledChunkMesh(geometry, probeMaterial(options.channel, geometry));
    mesh.position.copy(child.position);
    mesh.castShadow = options.channel === "lit";
    mesh.receiveShadow = options.channel === "lit";
    probes.add(mesh);
  }
  chunks.visible = false;

  return probes;
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
  const lit = options.channel === "lit";
  renderer.shadowMap.enabled = lit;
  const target = options.channel === "velocity" ?
    velocityTarget(renderer) :
    new THREE.RenderTarget(kSize, kSize, { type: THREE.FloatType });
  renderer.setRenderTarget(target);

  const engine = new VoxelEngine({
    chunkSize: 8,
    lighting: {
      ambientOcclusion: options.ambientOcclusion ? 1 : 0
    },
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
  if (lit) {
    for (let x = 1; x < 4; x++) {
      for (let z = 1; z < 4; z++) {
        layer.setVoxelAt({ x, y: 4, z }, { blockId: 1, transform: 0 });
      }
    }
  }
  engine.flush();

  const chunks = engine.root.getObjectByName("VoxelView:chunks")!;
  const probes = swapProbeMeshes(chunks, options);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x102030);
  const directional = new THREE.DirectionalLight(0xffffff, 2);
  directional.position.set(3, 8, 5);
  directional.castShadow = lit;
  directional.shadow.camera.left = -8;
  directional.shadow.camera.right = 8;
  directional.shadow.camera.top = 8;
  directional.shadow.camera.bottom = -8;
  scene.add(
    probes,
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
      if (options.channel === "velocity" && frame === 3) {
        camera.position.set(8, 7.5, 11);
        camera.lookAt(2.5, 1, 2.5);
        camera.updateMatrixWorld();
      }
      renderer.render(scene, camera);
    });
    if (options.channel === "velocity") {
      const halves = await renderer.readRenderTargetPixelsAsync(
        target, 0, 0, kSize, kSize, 1
      );

      return Array.from(
        halves as Uint16Array,
        (half) => Math.round(THREE.DataUtils.fromHalfFloat(half) * kSize * 2)
      );
    }
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, kSize, kSize);

    return Array.from(pixels as Float32Array, (value) => Math.round(value * 1024));
  }
  finally {
    for (const probe of probes.children as THREE.Mesh[]) {
      (probe.material as THREE.Material).dispose();
      if (options.expanded) {
        probe.geometry.dispose();
      }
    }
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
