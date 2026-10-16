// Import Third-party Dependencies
import * as THREE from "three";
import {
  BLOCK_PIECE_EMPTY_GROUP,
  BlockSurface,
  type BlockPieces,
  type MaterialGroupList,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { fitGeometry } from "../../preview/PreviewStage.ts";
import { createSurfaceMaterial } from "./surfaceMaterial.ts";

// CONSTANTS
const kFallbackColor = 0xaaaaaa;
const kCheckerCells = 4;
const kCheckerLight = [0x6b, 0x73, 0x7a];
const kCheckerDark = [0x45, 0x4b, 0x51];
const kOutlineColor = 0xd0d6dc;
const kOutlineOpacity = 0.35;
const kOutlineThresholdAngle = 20;

let checkerTexture: THREE.DataTexture | null = null;

export function buildBlockPreviewMesh(
  block: ResolvedBlockDefinition,
  pieces: BlockPieces,
  materialGroups?: MaterialGroupList
): THREE.Mesh {
  const geo = pieces.buildGeometry(block);
  if (geo === null) {
    const fallback = new THREE.BoxGeometry(1, 1, 1);
    fitGeometry(fallback);

    return new THREE.Mesh(
      fallback,
      new THREE.MeshLambertMaterial({ color: kFallbackColor })
    );
  }

  const textured = createSurfaceMaterial(
    new BlockSurface(block),
    pieces.resolveTexture(block),
    materialGroups
  );
  const materials = [
    textured,
    new THREE.MeshLambertMaterial({
      map: createCheckerTexture(),
      side: textured.side,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })
  ];

  const emptyIndices = collectEmptyIndices(geo);
  fitGeometry(geo);

  const mesh = new THREE.Mesh(geo, materials);
  if (emptyIndices.length > 0) {
    mesh.add(buildOutline(geo, emptyIndices));
  }

  return mesh;
}

function collectEmptyIndices(
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
