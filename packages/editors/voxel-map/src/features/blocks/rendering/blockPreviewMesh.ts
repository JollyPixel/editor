// Import Third-party Dependencies
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  BLOCK_PIECE_EMPTY_GROUP,
  BlockSurface,
  type BlockPieces,
  type MaterialGroupList,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { SceneLighting } from "../../../shared/SceneLighting.ts";

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

export const PREVIEW_FIT_RADIUS = Math.tan((kCameraFov * Math.PI) / 360) *
  kCameraZ * kFitFactor;
export const PREVIEW_TILT = 0.4;
export const PREVIEW_ROTATION_STEP = 0.005;
export const PREVIEW_STILL_ROTATION = Math.PI / 4;

let checkerTexture: THREE.DataTexture | null = null;

export interface BlockPreviewStage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function createBlockPreviewStage(): BlockPreviewStage {
  const scene = new THREE.Scene();
  scene.add(...new SceneLighting().lights);

  const camera = new THREE.PerspectiveCamera(kCameraFov, 1, 0.1, 20);
  camera.position.set(0, 0, kCameraZ);

  return {
    scene,
    camera
  };
}

export function lightWithEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): void {
  const room = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  scene.environment = generator.fromScene(room, kEnvironmentBlur).texture;
  scene.environmentIntensity = kEnvironmentIntensity;
  generator.dispose();
  room.dispose();
}

export function needsEnvironment(
  mesh: THREE.Mesh
): boolean {
  const materials = Array.isArray(mesh.material) ?
    mesh.material :
    [mesh.material];

  return materials.some(
    (material) => material instanceof THREE.MeshStandardMaterial
  );
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
  pieces: BlockPieces,
  materialGroups?: MaterialGroupList
): THREE.Mesh {
  const geo = pieces.geometryOf(block);
  if (geo === null) {
    const fallback = new THREE.BoxGeometry(1, 1, 1);
    fitGeometry(fallback);

    return new THREE.Mesh(
      fallback,
      new THREE.MeshLambertMaterial({ color: kFallbackColor })
    );
  }

  const texture = pieces.textureOf(block);
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
    materialGroups?.get(surface.materialGroup);
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

function emptyIndicesOf(
  geometry: THREE.BufferGeometry
): number[] {
  const index = geometry.getIndex();
  if (index === null) {
    return [];
  }

  return geometry.groups
    .filter((group) => group.materialIndex === BLOCK_PIECE_EMPTY_GROUP)
    .flatMap((group) => Array.from(
      index.array.subarray(group.start, group.start + group.count)
    ));
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
