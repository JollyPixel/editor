// Import Third-party Dependencies
import * as THREE from "three";
import {
  buildShapeGeometry,
  BlockSurface,
  tileRefForSlot,
  type ResolvedBlockDefinition,
  type BlockShapeRegistry,
  type TilesetManager,
  type TilesetUVRegion
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kCameraFov = 45;
const kCameraZ = 2.2;
const kAmbientIntensity = 1.5;
const kDirIntensity = 1.2;
const kFitFactor = 0.78;
const kFallbackColor = 0xaaaaaa;

export const PREVIEW_FIT_RADIUS = Math.tan((kCameraFov * Math.PI) / 360) *
  kCameraZ * kFitFactor;
export const PREVIEW_TILT = 0.4;
export const PREVIEW_ROTATION_STEP = 0.005;

export interface BlockPreviewSources {
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
}

export interface BlockPreviewStage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function createBlockPreviewStage(): BlockPreviewStage {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, kAmbientIntensity));
  const dir = new THREE.DirectionalLight(0xffffff, kDirIntensity);
  dir.position.set(3, 5, 3);
  scene.add(dir);

  const camera = new THREE.PerspectiveCamera(kCameraFov, 1, 0.1, 20);
  camera.position.set(0, 0, kCameraZ);

  return {
    scene,
    camera
  };
}

export function fitGeometry(
  geometry: THREE.BufferGeometry
): void {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (sphere === null || sphere.radius <= 0) {
    return;
  }

  const { center, radius } = sphere;
  const scale = PREVIEW_FIT_RADIUS / radius;
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale, scale, scale);
}

export function buildBlockPreviewMesh(
  block: ResolvedBlockDefinition,
  sources: BlockPreviewSources
): THREE.Mesh {
  const { shapeRegistry, tilesetManager } = sources;
  const shape = shapeRegistry.get(block.shapeId);
  if (!shape) {
    const fallback = new THREE.BoxGeometry(1, 1, 1);
    fitGeometry(fallback);

    return new THREE.Mesh(
      fallback,
      new THREE.MeshLambertMaterial({ color: kFallbackColor })
    );
  }

  const tilesetId =
    block.defaultTexture?.tilesetId ??
    tilesetManager.defaultTilesetId ??
    undefined;
  const texture = tilesetManager.has(tilesetId) ?
    tilesetManager.atlas(tilesetId).texture :
    null;
  const surface = new BlockSurface(block);
  const mat = new THREE.MeshLambertMaterial({
    map: texture,
    side: surface.side === "double" ? THREE.DoubleSide : THREE.FrontSide,
    alphaTest: surface.alphaCutoff,
    transparent: surface.alphaMode === "blend",
    depthWrite: surface.alphaMode !== "blend"
  });

  const { positions, normals, uvs, indices, ranges } = buildShapeGeometry(
    shape
  );

  const vertices = Float32Array.from(positions);
  const atlasUvs = Float32Array.from(uvs);

  for (const range of ranges) {
    const tileRef = tileRefForSlot(block, range.slot);
    if (!tileRef || !texture) {
      continue;
    }

    let region: TilesetUVRegion;
    try {
      region = tilesetManager
        .atlas(tileRef.tilesetId)
        .uvFor(tileRef.col, tileRef.row);
    }
    catch {
      continue;
    }

    const end = range.start + range.count;
    for (let index = range.start; index < end; index++) {
      atlasUvs[index * 2] = region.offsetU +
        (atlasUvs[index * 2] * region.scaleU);
      atlasUvs[(index * 2) + 1] = region.offsetV +
        (atlasUvs[(index * 2) + 1] * region.scaleV);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(atlasUvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  fitGeometry(geo);

  return new THREE.Mesh(geo, mat);
}
