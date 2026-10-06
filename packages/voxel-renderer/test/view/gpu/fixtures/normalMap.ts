// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { renderFrames } from "./renderFrames.ts";
import { createView } from "../../../helpers/view.ts";

// CONSTANTS
const kTileTexels = 16;
const kCellPixels = 32;
const kTilt = 0.5;
const kGroup = "relief";

export const NORMAL_TILES = ["flat", "right", "left", "up", "down"] as const;

export type NormalTile = typeof NORMAL_TILES[number];

export interface NormalProbeOptions {
  forceWebGL: boolean;
  material: "lambert" | "standard";
  light: THREE.Vector3Tuple;
  normal: boolean;
  normalScale?: number;
}

export type NormalProbe = Record<NormalTile, number>;

const kDirections: Record<NormalTile, THREE.Vector3Tuple> = {
  flat: [0, 0, 1],
  right: [kTilt, 0, 1],
  left: [-kTilt, 0, 1],
  up: [0, kTilt, 1],
  down: [0, -kTilt, 1]
};

async function tileImage(
  fill: (tile: NormalTile) => string
): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  canvas.width = kTileTexels * NORMAL_TILES.length;
  canvas.height = kTileTexels;
  const context = canvas.getContext("2d")!;
  for (const [index, tile] of NORMAL_TILES.entries()) {
    context.fillStyle = fill(tile);
    context.fillRect(index * kTileTexels, 0, kTileTexels, kTileTexels);
  }
  const image = new Image();
  image.src = canvas.toDataURL();
  await image.decode();

  return image;
}

function encodeNormal(
  tile: NormalTile
): string {
  const normal = new THREE.Vector3(...kDirections[tile]).normalize();
  const [red, green, blue] = normal.toArray().map(
    (value) => Math.round(((value * 0.5) + 0.5) * 255)
  );

  return `rgb(${red}, ${green}, ${blue})`;
}

export async function renderNormalScene(
  options: NormalProbeOptions
): Promise<NormalProbe> {
  const width = NORMAL_TILES.length * kCellPixels;
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

  const view = createView({
    chunkSize: 8,
    blocks: NORMAL_TILES.map((tile, index) => {
      return {
        id: index + 1,
        name: tile,
        shapeId: "cube",
        defaultTexture: { blocksetId: "atlas", col: index, row: 0 },
        materialGroup: options.normalScale === undefined ? undefined : kGroup
      };
    }),
    materialGroups: options.normalScale === undefined ?
      [] :
      [{ id: kGroup, normalScale: options.normalScale }],
    rendering: {
      material: options.material
    }
  });
  const normal = options.normal ?
    new THREE.Texture(await tileImage(encodeNormal)) :
    undefined;
  view.loadBlockset(
    { id: "atlas", src: "", tileSize: kTileTexels },
    new THREE.Texture(await tileImage(() => "#ffffff")),
    { normal }
  );
  const atlas = view.atlases.atlas("atlas");
  atlas.texture.needsUpdate = true;
  if (atlas.normal) {
    atlas.normal.needsUpdate = true;
  }
  const layer = view.document.world.addLayer("ground");
  for (const index of NORMAL_TILES.keys()) {
    layer.setVoxelAt({ x: index, y: 0, z: 0 }, {
      blockId: index + 1,
      transform: 0
    });
  }
  view.flush();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const light = new THREE.DirectionalLight(0xffffff, Math.PI);
  light.position.set(...options.light);
  light.target.position.set(0, 0, 0);
  scene.add(view.root, light, light.target);
  const camera = new THREE.OrthographicCamera(
    -NORMAL_TILES.length / 2,
    NORMAL_TILES.length / 2,
    0.5,
    -0.5,
    0.1,
    100
  );
  camera.position.set(NORMAL_TILES.length / 2, 0.5, 10);
  camera.lookAt(NORMAL_TILES.length / 2, 0.5, 0);
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
    const row = Math.floor(height / 2);
    const probe = {} as NormalProbe;
    for (const [index, tile] of NORMAL_TILES.entries()) {
      const column = (index * kCellPixels) + (kCellPixels / 2);
      probe[tile] = pixels[((row * width) + column) * 4];
    }

    return probe;
  }
  finally {
    view.dispose();
    target.dispose();
    renderer.dispose();
  }
}
