// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { VoxelEngine } from "../../../src/VoxelEngine.ts";
import { VoxelTransparencyRenderer } from "../../../src/render/VoxelTransparencyRenderer.ts";
import type { BlockAlphaMode, BlockSide } from "../../../src/blocks/BlockSurface.ts";

export interface ProbeOptions {
  alpha: number;
  mode?: BlockAlphaMode;
  side?: BlockSide;
  opacity?: number;
  greedy?: boolean;
  cull?: boolean;
  count?: number;
  reverse?: boolean;
  background?: number;
  forceWebGL?: boolean;
  startZ?: number;
  spacing?: number;
  colored?: boolean;
  reverseDrawOrder?: boolean;
  hole?: boolean;
  occluder?: boolean;
  resize?: boolean;
  failDraw?: boolean;
}

export async function probe(options: ProbeOptions): Promise<number[]> {
  const renderer = new THREE.WebGPURenderer({
    forceWebGL: options.forceWebGL ?? true,
    antialias: false
  });
  renderer.setSize(32, 32);
  await renderer.init();
  if (options.forceWebGL === false &&
    !("isWebGPUBackend" in renderer.backend)) {
    renderer.dispose();
    throw new Error("The native WebGPU probe fell back to WebGL.");
  }
  renderer.toneMapping = THREE.NoToneMapping;
  const pipeline = new VoxelTransparencyRenderer(renderer);
  const target = new THREE.RenderTarget(32, 32);
  renderer.setRenderTarget(target);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d")!;
  context.fillStyle = `rgba(255, 255, 255, ${options.alpha})`;
  context.fillRect(0, 0, 1, 1);
  const engine = new VoxelEngine({
    chunkSize: 4,
    greedy: options.greedy,
    materialCustomizer(material, tilesetId) {
      // A constant unlit white isolates compositing from Lambert lighting.
      const color = tilesetId === "atlas" ? 0xff0000 : 0x0000ff;
      material.emissive.set(options.colored ? color : 0xffffff);
      material.color.setRGB(0, 0, 0);
    },
    blocks: [{
      id: 1,
      name: "Glass",
      shapeId: "cube",
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 },
      alphaMode: options.mode ?? "blend",
      side: options.side ?? "double",
      cullSelfFaces: options.cull ?? true
    }]
  });
  const image = new Image();
  image.src = canvas.toDataURL();
  await image.decode();
  engine.loadTileset({ id: "atlas", src: "", tileSize: 1 }, new THREE.Texture(image));
  const atlas = engine.tilesetManager.atlas("atlas").texture;
  atlas.needsUpdate = true;
  if (options.colored || options.hole) {
    const otherImage = new Image();
    if (options.hole) {
      context.clearRect(0, 0, 1, 1);
    }
    otherImage.src = canvas.toDataURL();
    await otherImage.decode();
    engine.loadTileset({ id: "other", src: "", tileSize: 1 }, new THREE.Texture(otherImage));
    engine.tilesetManager.atlas("other").texture.needsUpdate = true;
    if (options.colored) {
      engine.blockRegistry.register({
        id: 2,
        name: "Blue glass",
        shapeId: "cube",
        defaultTexture: { tilesetId: "other", col: 0, row: 0 },
        alphaMode: "blend",
        side: options.side ?? "double",
        cullSelfFaces: options.cull ?? true
      });
    }
    if (options.hole) {
      const block = engine.blockRegistry.get(1)!;
      engine.blockRegistry.register({
        ...block,
        faceTextures: {
          [options.reverse ? "back" : "front"]: {
            tilesetId: "other", col: 0, row: 0
          }
        }
      });
    }
  }
  const layer = engine.world.addLayer("test", { opacity: options.opacity ?? 1 });
  for (let depthIndex = 0; depthIndex < (options.count ?? 1); depthIndex++) {
    layer.setVoxelAt({
      x: 0,
      y: 0,
      z: (options.startZ ?? 0) + depthIndex * (options.spacing ?? 1)
    }, { blockId: options.colored ? depthIndex % 2 + 1 : 1, transform: 0 });
  }
  engine.flush();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(options.background ?? 0);
  scene.add(engine.root);
  if (options.reverseDrawOrder) {
    engine.root.children.reverse();
  }
  const occluder = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicNodeMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
  );
  if (options.occluder) {
    occluder.position.set(0.5, 0.5, options.reverse ? -1 : 7);
    scene.add(occluder);
  }
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0.5, 0.5, options.reverse ? -10 : 10);
  camera.lookAt(0.5, 0.5, 0.5);
  camera.updateMatrixWorld();
  const initialBackground = scene.background;
  const initialClearColor = renderer.getClearColor(new THREE.Color());
  const initialClearAlpha = renderer.getClearAlpha();
  function verifyState(): void {
    if (renderer.getRenderTarget() !== target ||
      scene.background !== initialBackground ||
      !renderer.getClearColor(new THREE.Color()).equals(initialClearColor) ||
      renderer.getClearAlpha() !== initialClearAlpha ||
      renderer.toneMapping !== THREE.NoToneMapping ||
      !renderer.autoClear || !renderer.opaque || !renderer.transparent ||
      renderer.getMRT() !== null) {
      throw new Error("Compositing did not restore renderer state.");
    }
    for (const child of engine.root.children) {
      if (child instanceof THREE.Mesh) {
        const material = child.material;
        if (material.blending !== THREE.NormalBlending ||
          material.depthWrite === material.transparent) {
          throw new Error("Compositing did not restore material state.");
        }
      }
    }
  }
  try {
    if (options.failDraw) {
      const failure = new Error("Injected draw failure");
      function renderObject(): never {
        throw failure;
      }
      renderer.setRenderObjectFunction(renderObject);
      let caught: unknown;
      try {
        pipeline.render(scene, camera);
      }
      catch (error) {
        caught = error;
      }
      if (caught !== failure ||
        renderer.getRenderObjectFunction() !== renderObject) {
        throw new Error("Compositing did not preserve the draw failure and callback.");
      }
      verifyState();
      renderer.setRenderObjectFunction(null);
    }
    pipeline.render(scene, camera);
    verifyState();
    if (options.resize) {
      target.setSize(64, 64);
      pipeline.render(scene, camera);
      verifyState();
    }
    const center = target.width / 2;
    const pixels = await renderer.readRenderTargetPixelsAsync(target, center, center, 1, 1);

    return Array.from(pixels);
  }
  finally {
    engine.dispose();
    pipeline.dispose();
    target.dispose();
    renderer.dispose();
    occluder.geometry.dispose();
    occluder.material.dispose();
  }
}
