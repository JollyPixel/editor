// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type {
  BlockShapeJSON,
  BlockTransformJSON,
  MirrorAxes
} from "@jolly-pixel/asset.voxel-model/client";
import {
  clampUvRegion,
  type FaceRanges
} from "@jolly-pixel/editor.pixel-art/mesh-texturing";
import { roundTo } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { BlockNode } from "./BlockNode.ts";
import { plainVector3 } from "./plainVector3.ts";
import {
  BlockShapeMesh,
  type BlockShapeChanges
} from "./BlockShapeMesh.ts";

// CONSTANTS
const kTransformRoundDecimals = 2;

export type BlockMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardNodeMaterial>;

export interface BlockBodyOptions {
  shape: BlockShapeJSON;
  flip?: MirrorAxes;
  size: THREE.Vector3;
  texture: THREE.Texture | null;
}

export class BlockBody {
  readonly node = new BlockNode();
  readonly mesh: BlockMesh;

  readonly #shapeMesh: BlockShapeMesh;
  readonly #pivotOffset = new THREE.Vector3();

  constructor(
    options: BlockBodyOptions
  ) {
    const { shape, flip, size, texture } = options;

    this.#shapeMesh = new BlockShapeMesh({ shape, flip, size });
    this.mesh = new THREE.Mesh(
      this.#shapeMesh.geometry,
      new THREE.MeshStandardNodeMaterial({
        alphaTest: 0.01,
        side: THREE.DoubleSide
      })
    );
    clampUvRegion(this.mesh, texture);
    this.node.add(this.mesh);
  }

  get size(): THREE.Vector3 {
    return this.#shapeMesh.size;
  }

  get shape(): BlockShapeJSON {
    return this.#shapeMesh.shape;
  }

  get faces(): Readonly<FaceRanges> {
    return this.#shapeMesh.faces;
  }

  get pivotOffset(): THREE.Vector3 {
    return this.#pivotOffset.clone();
  }

  get transform(): BlockTransformJSON {
    return {
      position: plainVector3(this.node.position),
      pivotOffset: plainVector3(this.#pivotOffset),
      size: plainVector3(this.#shapeMesh.size),
      scale: plainVector3(this.node.scale),
      rotation: plainVector3(this.node.rotation)
    };
  }

  set transform(
    transform: BlockTransformJSON
  ) {
    const { rotation } = transform;

    this.node.position.copy(transform.position);
    this.moveBoxAroundPivot(new THREE.Vector3().copy(transform.pivotOffset));
    this.node.rotation.set(rotation.x, rotation.y, rotation.z);
    this.node.scale.copy(transform.scale);
    this.resize(new THREE.Vector3().copy(transform.size));
  }

  moveBoxAroundPivot(
    offset: THREE.Vector3
  ): void {
    this.#pivotOffset.copy(offset);
    this.mesh.position.copy(offset).negate();
  }

  resize(
    size: THREE.Vector3
  ): void {
    if (!sameRounded(this.#shapeMesh.size, size, kTransformRoundDecimals)) {
      this.#shapeMesh.resize(size);
    }
  }

  roundTransform(
    decimals: number = kTransformRoundDecimals
  ): void {
    const { position, rotation, scale } = this.node;

    roundVector(position, decimals);
    rotation.set(
      roundAngle(rotation.x, decimals),
      roundAngle(rotation.y, decimals),
      roundAngle(rotation.z, decimals)
    );
    roundVector(scale, decimals);
    this.moveBoxAroundPivot(roundVector(this.pivotOffset, decimals));
  }

  rebuild(
    changes: BlockShapeChanges
  ): boolean {
    if (!this.#shapeMesh.rebuild(changes)) {
      return false;
    }

    this.mesh.geometry = this.#shapeMesh.geometry;
    clampUvRegion(this.mesh, this.mesh.material.map);

    return true;
  }

  restoreBaseUv(): void {
    this.#shapeMesh.restoreBaseUv();
  }

  dispose(): void {
    this.#shapeMesh.dispose();
    this.mesh.material.dispose();
    this.node.removeFromParent();
  }
}

function roundVector(
  vector: THREE.Vector3,
  decimals: number
): THREE.Vector3 {
  return vector.set(
    roundTo(vector.x, decimals),
    roundTo(vector.y, decimals),
    roundTo(vector.z, decimals)
  );
}

function roundAngle(
  radians: number,
  decimals: number
): number {
  return THREE.MathUtils.degToRad(
    roundTo(THREE.MathUtils.radToDeg(radians), decimals)
  );
}

function sameRounded(
  left: THREE.Vector3,
  right: THREE.Vector3,
  decimals: number
): boolean {
  return roundTo(left.x, decimals) === roundTo(right.x, decimals) &&
    roundTo(left.y, decimals) === roundTo(right.y, decimals) &&
    roundTo(left.z, decimals) === roundTo(right.z, decimals);
}
