// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { UVSlot } from "@jolly-pixel/pixel-draw.renderer";
import type { FaceRanges } from "@jolly-pixel/editor.pixel-art/mesh-texturing";
import {
  BlockShape,
  NO_FLIP,
  type BlockShapeJSON,
  type MirrorAxes
} from "@jolly-pixel/asset.voxel-model/client";

export interface BlockGeometry {
  /**
   * Its `uv` attribute holds each face's own 0 to 1 coordinates.
   */
  geometry: THREE.BufferGeometry;
  faces: Readonly<FaceRanges>;
}

// CONSTANTS
const kQuadCount = 4;
const kBoxFaces: Readonly<FaceRanges> = Object.freeze(Object.fromEntries(
  ["right", "left", "top", "bottom", "front", "back"].map(
    (slot, face) => [slot, [{ start: face * kQuadCount, count: kQuadCount }]]
  )
));

export function blockGeometry(
  shape: BlockShapeJSON,
  size: THREE.Vector3,
  flip: Readonly<MirrorAxes> = NO_FLIP
): BlockGeometry {
  return placed(unitGeometry(shape), size, flip);
}

function unitGeometry(
  shape: BlockShapeJSON
): BlockGeometry {
  switch (shape.type) {
    case "box":
      return {
        geometry: new THREE.BoxGeometry(1, 1, 1),
        faces: kBoxFaces
      };
    case "plane":
      return planeGeometry();
    case "cylinder":
    case "cone":
      return roundGeometry(shape);
    case "torus":
      return torusGeometry(shape);
  }
}

function planeGeometry(): BlockGeometry {
  const faces = new FacetedGeometry();
  faces.add("top", [
    { position: new THREE.Vector3(-0.5, 0, -0.5), uv: [0, 1] },
    { position: new THREE.Vector3(0.5, 0, -0.5), uv: [1, 1] },
    { position: new THREE.Vector3(-0.5, 0, 0.5), uv: [0, 0] },
    { position: new THREE.Vector3(0.5, 0, 0.5), uv: [1, 0] }
  ], [[0, 2, 1], [2, 3, 1]], new THREE.Vector3(0, 1, 0));

  return faces.build();
}

interface FaceVertex {
  position: THREE.Vector3;
  uv: readonly [number, number];
}

class FacetedGeometry {
  #positions: number[] = [];
  #normals: number[] = [];
  #uvs: number[] = [];
  #indices: number[] = [];
  #faces: Record<UVSlot, { start: number; count: number; }[]> = {};

  add(
    slot: UVSlot,
    vertices: readonly FaceVertex[],
    triangles: readonly (readonly [number, number, number])[],
    outward: THREE.Vector3
  ): void {
    const start = this.#positions.length / 3;
    const [a, b, c] = triangles[0].map((index) => vertices[index].position);
    const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    const inward = normal.dot(outward) < 0;
    if (inward) {
      normal.negate();
    }

    for (const vertex of vertices) {
      this.#positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
      this.#normals.push(normal.x, normal.y, normal.z);
      this.#uvs.push(vertex.uv[0], vertex.uv[1]);
    }
    for (const [i, j, k] of triangles) {
      this.#indices.push(start + i, ...(inward ? [start + k, start + j] : [start + j, start + k]));
    }

    const ranges = this.#faces[slot] ?? [];
    this.#faces[slot] = ranges;
    const last = ranges.at(-1);
    if (last !== undefined && last.start + last.count === start) {
      last.count += vertices.length;
    }
    else {
      ranges.push({ start, count: vertices.length });
    }
  }

  build(): BlockGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.#positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.#normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(this.#uvs, 2));
    geometry.setIndex(this.#indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return {
      geometry,
      faces: Object.freeze({ ...this.#faces })
    };
  }
}

function roundGeometry(
  shape: Extract<BlockShapeJSON, { type: "cylinder" | "cone"; }>
): BlockGeometry {
  const sides = BlockShape.sideSlots(shape.sides);
  const pointed = BlockShape.isPointed(shape);
  const rim = unitPolygon(shape.sides);
  const top = 0.5;
  const bottom = -0.5;
  const faces = new FacetedGeometry();

  sides.forEach((slot, index) => {
    const right = rim[index];
    const left = rim[(index + 1) % rim.length];
    const outward = new THREE.Vector3((left.x + right.x) / 2, 0, (left.y + right.y) / 2);
    const bottomLeft = { position: new THREE.Vector3(left.x, bottom, left.y), uv: [0, 0] as const };
    const bottomRight = { position: new THREE.Vector3(right.x, bottom, right.y), uv: [1, 0] as const };

    if (pointed) {
      faces.add(slot, [
        { position: new THREE.Vector3(0, top, 0), uv: [0.5, 1] },
        bottomLeft,
        bottomRight
      ], [[0, 1, 2]], outward);
    }
    else {
      faces.add(slot, [
        { position: new THREE.Vector3(left.x, top, left.y), uv: [0, 1] },
        { position: new THREE.Vector3(right.x, top, right.y), uv: [1, 1] },
        bottomLeft,
        bottomRight
      ], [[0, 2, 1], [2, 3, 1]], outward);
    }
  });

  const fan = rim.slice(2).map((_, index) => [0, index + 1, index + 2] as const);
  if (BlockShape.slots(shape).includes("top")) {
    faces.add("top", rim.map((point) => {
      return {
        position: new THREE.Vector3(point.x, top, point.y),
        uv: [point.x + 0.5, 0.5 - point.y] as const
      };
    }), fan, new THREE.Vector3(0, 1, 0));
  }
  faces.add("bottom", rim.map((point) => {
    return {
      position: new THREE.Vector3(point.x, bottom, point.y),
      uv: [point.x + 0.5, 0.5 + point.y] as const
    };
  }), fan, new THREE.Vector3(0, -1, 0));

  return faces.build();
}

function torusGeometry(
  shape: Extract<BlockShapeJSON, { type: "torus"; }>
): BlockGeometry {
  const { sides, ringSides, thickness } = shape;
  const rim = unitPolygon(sides);
  const tube = Array.from({ length: ringSides + 1 }, (_, index) => 2 * Math.PI * index / ringSides);
  const tubeRadius = thickness / 2;
  const height = Math.max(...tube.map((angle) => Math.abs(Math.sin(angle))));
  const points = rim.map((outer) => tube.map((angle) => {
    const reach = 1 - tubeRadius + (tubeRadius * Math.cos(angle));

    return new THREE.Vector3(outer.x * reach, Math.sin(angle) / height / 2, outer.y * reach);
  }));

  const faces = new FacetedGeometry();
  BlockShape.sideSlots(sides).forEach((slot, index) => {
    const right = points[index];
    const left = points[(index + 1) % sides];
    const middle = rim[index].clone().add(rim[(index + 1) % sides]).normalize();
    for (let step = 0; step < ringSides; step++) {
      const angle = (tube[step] + tube[step + 1]) / 2;
      const reach = Math.cos(angle);
      const outward = new THREE.Vector3(middle.x * reach, Math.sin(angle), middle.y * reach);
      const top = 1 - (step / ringSides);
      const bottom = 1 - ((step + 1) / ringSides);
      faces.add(slot, [
        { position: left[step], uv: [0, top] },
        { position: right[step], uv: [1, top] },
        { position: left[step + 1], uv: [0, bottom] },
        { position: right[step + 1], uv: [1, bottom] }
      ], [[0, 2, 1], [2, 3, 1]], outward);
    }
  });

  return faces.build();
}

function unitPolygon(
  sides: number
): THREE.Vector2[] {
  const corners = Array.from({ length: sides }, (_, index) => {
    const angle = (Math.PI / 2) - (Math.PI / sides) + (2 * Math.PI * index / sides);

    return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  });
  const bounds = new THREE.Box2().setFromPoints(corners);
  const center = bounds.getCenter(new THREE.Vector2());
  const extent = bounds.getSize(new THREE.Vector2());

  return corners.map((corner) => corner.sub(center).divide(extent));
}

function placed(
  built: BlockGeometry,
  size: THREE.Vector3,
  flip: Readonly<MirrorAxes>
): BlockGeometry {
  const scale = new THREE.Vector3(
    signed(size.x, flip.x),
    signed(size.y, flip.y),
    signed(size.z, flip.z)
  );
  const { geometry } = built;
  geometry.applyMatrix4(new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z));

  if (scale.x * scale.y * scale.z < 0) {
    const index = geometry.getIndex()!;
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const second = index.getX(triangle + 1);
      index.setX(triangle + 1, index.getX(triangle + 2));
      index.setX(triangle + 2, second);
    }
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return built;
}

function signed(
  length: number,
  flipped: boolean
): number {
  const magnitude = Math.max(Math.abs(length), Number.EPSILON);

  return flipped ? -magnitude : magnitude;
}
