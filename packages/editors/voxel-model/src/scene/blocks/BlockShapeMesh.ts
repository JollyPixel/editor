// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  BlockShape,
  NO_FLIP,
  type BlockShapeJSON,
  type MirrorAxes
} from "@jolly-pixel/asset.voxel-model/client";
import type { FaceRanges } from "@jolly-pixel/editor.pixel-art/mesh-texturing";

// Import Internal Dependencies
import { blockGeometry } from "./blockGeometry.ts";

export interface BlockShapeMeshOptions {
  shape: BlockShapeJSON;
  flip?: MirrorAxes;
  size: THREE.Vector3;
}

export interface BlockShapeChanges {
  shape?: BlockShapeJSON;
  flip?: MirrorAxes;
}

interface BuiltShape {
  shape: BlockShapeJSON;
  flip: MirrorAxes;
  geometry: THREE.BufferGeometry;
  faces: Readonly<FaceRanges>;
  baseUv: Float32Array;
}

export class BlockShapeMesh {
  #size: THREE.Vector3;
  #built: BuiltShape;

  constructor(
    options: BlockShapeMeshOptions
  ) {
    const { shape, flip = NO_FLIP, size } = options;
    this.#size = size.clone();
    this.#built = build(shape, flip, this.#size);
  }

  get shape(): BlockShapeJSON {
    return { ...this.#built.shape };
  }

  get size(): THREE.Vector3 {
    return this.#size.clone();
  }

  get geometry(): THREE.BufferGeometry {
    return this.#built.geometry;
  }

  get faces(): Readonly<FaceRanges> {
    return this.#built.faces;
  }

  rebuild(
    changes: BlockShapeChanges
  ): boolean {
    const previous = this.#built;
    const { shape = previous.shape, flip = previous.flip } = changes;
    if (sameMirror(previous.flip, flip) && BlockShape.same(previous.shape, shape)) {
      return false;
    }

    this.#built = build(shape, flip, this.#size);
    previous.geometry.dispose();

    return true;
  }

  resize(
    size: THREE.Vector3
  ): void {
    const { shape, flip, geometry } = this.#built;
    const next = blockGeometry(shape, size, flip).geometry;
    for (const name of ["position", "normal"]) {
      const target = geometry.getAttribute(name);
      target.array.set(next.getAttribute(name).array);
      target.needsUpdate = true;
    }
    next.dispose();

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    this.#size.copy(size);
  }

  restoreBaseUv(): void {
    const uv = this.#built.geometry.getAttribute("uv");
    uv.array.set(this.#built.baseUv);
    uv.needsUpdate = true;
  }

  dispose(): void {
    this.#built.geometry.dispose();
  }
}

function build(
  shape: BlockShapeJSON,
  flip: MirrorAxes,
  size: THREE.Vector3
): BuiltShape {
  const { geometry, faces } = blockGeometry(shape, size, flip);

  return {
    shape: { ...shape },
    flip: { ...flip },
    geometry,
    faces,
    baseUv: Float32Array.from(geometry.getAttribute("uv").array)
  };
}

function sameMirror(
  left: MirrorAxes,
  right: MirrorAxes
): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}
