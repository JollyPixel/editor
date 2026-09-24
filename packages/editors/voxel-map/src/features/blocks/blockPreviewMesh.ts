// Import Third-party Dependencies
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  buildShapeGeometry,
  shapeSlots,
  BlockSurface,
  BlockTextures,
  VoxelTransform,
  type FaceDefinition,
  type ResolvedBlockDefinition,
  type BlockShapeRegistry,
  type MaterialGroupList,
  type TilesetManager
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { SceneLighting } from "../../scene/SceneLighting.ts";
import type { TileOpacityProbe } from "./tileOpacity.ts";

// CONSTANTS
const kCameraFov = 45;
const kCameraZ = 2.2;
const kFitFactor = 0.78;
const kFallbackColor = 0xaaaaaa;
const kCheckerCells = 4;
const kCheckerLight = [0x6b, 0x73, 0x7a];
const kCheckerDark = [0x45, 0x4b, 0x51];
const kOutlineColor = 0xd0d6dc;
const kOutlineOpacity = 0.35;
const kOutlineThresholdAngle = 20;
const kEnvironmentBlur = 0.04;
const kEnvironmentIntensity = 0.6;

export const BLOCK_TEXTURED_MATERIAL = 0;
export const BLOCK_EMPTY_MATERIAL = 1;
export const PREVIEW_FIT_RADIUS = Math.tan((kCameraFov * Math.PI) / 360) *
  kCameraZ * kFitFactor;
export const PREVIEW_TILT = 0.4;
export const PREVIEW_ROTATION_STEP = 0.005;

let checkerTexture: THREE.DataTexture | null = null;

export interface BlockPreviewSources {
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
  tileOpacity: TileOpacityProbe;
  materialGroups?: MaterialGroupList;
}

export interface BlockPreviewStage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function createBlockPreviewStage(
  renderer?: THREE.WebGLRenderer
): BlockPreviewStage {
  const scene = new THREE.Scene();
  scene.add(...new SceneLighting().lights);
  if (renderer) {
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(renderer);
    scene.environment = generator.fromScene(room, kEnvironmentBlur).texture;
    scene.environmentIntensity = kEnvironmentIntensity;
    generator.dispose();
    room.dispose();
  }

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

export function emptyTextureSlots(
  block: ResolvedBlockDefinition,
  sources: BlockPreviewSources
): string[] {
  const shape = sources.shapeRegistry.get(block.shapeId);
  if (!shape) {
    return [];
  }

  const textures = BlockTextures.of(block);
  const { alphaCutoff } = new BlockSurface(block);

  return shapeSlots(shape)
    .map((slot) => slot.id)
    .filter((slot) => sources.tileOpacity.isEmpty(
      textures.forSlot(slot),
      alphaCutoff
    ));
}

export function buildBlockPreviewMesh(
  block: ResolvedBlockDefinition,
  sources: BlockPreviewSources
): THREE.Mesh {
  const geo = buildBlockGeometry(block, sources);
  if (geo === null) {
    const fallback = new THREE.BoxGeometry(1, 1, 1);
    fitGeometry(fallback);

    return new THREE.Mesh(
      fallback,
      new THREE.MeshLambertMaterial({ color: kFallbackColor })
    );
  }

  const texture = textureOf(block, sources);
  const surface = new BlockSurface(block);
  const side = surface.side === "double" ? THREE.DoubleSide : THREE.FrontSide;
  const surfaceOptions = {
    map: texture,
    side,
    alphaTest: surface.alphaCutoff,
    transparent: surface.alphaMode === "blend",
    depthWrite: surface.alphaMode !== "blend"
  };
  const group = surface.materialGroup === undefined ?
    undefined :
    sources.materialGroups?.get(surface.materialGroup);
  const textured = group === undefined ?
    new THREE.MeshLambertMaterial(surfaceOptions) :
    new THREE.MeshStandardMaterial(surfaceOptions);
  group?.applyTo(textured);
  const materials = [
    textured,
    new THREE.MeshLambertMaterial({
      map: createCheckerTexture(),
      side,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })
  ];

  const emptyIndices = emptyIndicesOf(geo);
  fitGeometry(geo);

  const mesh = new THREE.Mesh(geo, materials);
  if (emptyIndices.length > 0) {
    mesh.add(buildOutline(geo, emptyIndices));
  }

  return mesh;
}

export function buildBlockGeometry(
  block: ResolvedBlockDefinition,
  sources: BlockPreviewSources,
  transform: VoxelTransform = VoxelTransform.Identity
): THREE.BufferGeometry | null {
  const { shapeRegistry, tilesetManager } = sources;
  const shape = shapeRegistry.get(block.shapeId);
  if (!shape) {
    return null;
  }

  const texture = textureOf(block, sources);
  const { positions, normals, uvs, indices, ranges } = buildShapeGeometry(
    shape,
    transform
  );

  const atlasUvs = Float32Array.from(uvs);
  const geo = new THREE.BufferGeometry();

  const empty = new Set(emptyTextureSlots(block, sources));
  const textures = BlockTextures.of(block);
  let indexStart = 0;
  for (const range of ranges) {
    const indexCount = triangleIndexCount(range.definitions);
    const isEmpty = empty.has(range.slot);
    geo.addGroup(
      indexStart,
      indexCount,
      isEmpty ? BLOCK_EMPTY_MATERIAL : BLOCK_TEXTURED_MATERIAL
    );
    indexStart += indexCount;

    const tileRef = textures.forSlot(range.slot);
    if (isEmpty || !tileRef || !texture) {
      continue;
    }

    const region = tilesetManager
      .get(tileRef.tilesetId)
      ?.uvFor(
        tileRef.col,
        tileRef.row,
        tileRef.size,
        textures.spanFor(range.slot, range.span)
      );
    if (!region) {
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

  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(Float32Array.from(positions), 3)
  );
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(atlasUvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  return geo;
}

export function textureOf(
  block: ResolvedBlockDefinition,
  sources: BlockPreviewSources
): THREE.Texture | null {
  return sources.tilesetManager
    .get(block.defaultTexture?.tilesetId)
    ?.texture ?? null;
}

function emptyIndicesOf(
  geometry: THREE.BufferGeometry
): number[] {
  const index = geometry.getIndex();
  if (index === null) {
    return [];
  }

  return geometry.groups
    .filter((group) => group.materialIndex === BLOCK_EMPTY_MATERIAL)
    .flatMap((group) => Array.from(
      index.array.subarray(group.start, group.start + group.count)
    ));
}

function triangleIndexCount(
  definitions: readonly FaceDefinition[]
): number {
  return definitions.reduce(
    (count, definition) => count + ((definition.vertices.length - 2) * 3),
    0
  );
}

function buildOutline(
  geometry: THREE.BufferGeometry,
  indices: number[]
): THREE.LineSegments {
  const faces = new THREE.BufferGeometry();
  faces.setAttribute("position", geometry.getAttribute("position"));
  faces.setIndex(indices);
  const edges = new THREE.EdgesGeometry(faces, kOutlineThresholdAngle);

  return new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color: kOutlineColor,
      transparent: true,
      opacity: kOutlineOpacity
    })
  );
}

function createCheckerTexture(): THREE.DataTexture {
  if (checkerTexture !== null) {
    return checkerTexture;
  }

  const data = new Uint8Array(kCheckerCells * kCheckerCells * 4);
  for (let y = 0; y < kCheckerCells; y++) {
    for (let x = 0; x < kCheckerCells; x++) {
      const [r, g, b] = (x + y) % 2 === 0 ? kCheckerLight : kCheckerDark;
      data.set([r, g, b, 255], ((y * kCheckerCells) + x) * 4);
    }
  }

  checkerTexture = new THREE.DataTexture(
    data,
    kCheckerCells,
    kCheckerCells
  );
  checkerTexture.magFilter = THREE.NearestFilter;
  checkerTexture.minFilter = THREE.NearestFilter;
  checkerTexture.colorSpace = THREE.SRGBColorSpace;
  checkerTexture.needsUpdate = true;

  return checkerTexture;
}
