// Import Third-party Dependencies
import * as THREE from "three";
import {
  svg,
  type SVGTemplateResult
} from "lit";
import type {
  BlockShape,
  FaceDefinition
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kYaw = Math.PI / 4;
const kPitch = Math.PI / 6;
const kToCamera = new THREE.Vector3(
  -Math.sin(kYaw) * Math.cos(kPitch),
  Math.sin(kPitch),
  -Math.cos(kYaw) * Math.cos(kPitch)
).normalize();
const kScreenRight = new THREE.Vector3(0, 1, 0).cross(kToCamera).normalize();
const kScreenUp = kToCamera.clone().cross(kScreenRight);
const kToLight = new THREE.Vector3(-0.45, 1, -0.75).normalize();
const kAmbient = 0.35;
const kPadding = 0.06;
const kBackdrop = "var(--jolly-surface-raised, Canvas)";
const kUnitCube = new THREE.Box3(
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(1, 1, 1)
);
const kVertex = new THREE.Vector3();

export type ShapeGlyphPoint = readonly [number, number];

export interface ShapeGlyphFace {
  readonly points: readonly ShapeGlyphPoint[];
  readonly light: number;
}

export class ShapeGlyph {
  static readonly VIEW_BOX = ShapeGlyph.#unitViewBox();

  readonly faces: readonly ShapeGlyphFace[];

  constructor(
    shape: BlockShape
  ) {
    this.faces = shape.faces
      .filter((face) => kVertex.fromArray(face.normal).dot(kToCamera) > 1e-6)
      .map((face) => {
        return {
          face,
          depth: ShapeGlyph.#depth(face)
        };
      })
      .sort((a, b) => a.depth - b.depth)
      .map(({ face }) => {
        return {
          points: face.vertices.map(
            (vertex) => ShapeGlyph.#project(kVertex.fromArray(vertex))
          ),
          light: ShapeGlyph.#light(face)
        };
      });
  }

  toSVG(): SVGTemplateResult {
    return svg`
      <g
        class="tone-ink"
        stroke="currentColor"
        stroke-width="0.035"
        stroke-linejoin="round"
      >
        ${this.faces.map((face) => svg`
          <path
            d=${ShapeGlyph.#path(face)}
            style=${ShapeGlyph.#fill(face)}
          />
        `)}
      </g>
    `;
  }

  static #fill(
    face: ShapeGlyphFace
  ): string {
    const ink = Math.round(face.light * 100);

    return `fill: color-mix(in oklab, currentcolor ${ink}%, ${kBackdrop})`;
  }

  static #depth(
    face: FaceDefinition
  ): number {
    let total = 0;
    for (const vertex of face.vertices) {
      total += kVertex.fromArray(vertex).dot(kToCamera);
    }

    return total / face.vertices.length;
  }

  static #light(
    face: FaceDefinition
  ): number {
    const facing = Math.max(0, kVertex.fromArray(face.normal).dot(kToLight));

    return kAmbient + ((1 - kAmbient) * facing);
  }

  static #project(
    vertex: THREE.Vector3
  ): ShapeGlyphPoint {
    return [
      ShapeGlyph.#round(vertex.dot(kScreenRight)),
      ShapeGlyph.#round(-vertex.dot(kScreenUp))
    ];
  }

  static #path(
    face: ShapeGlyphFace
  ): string {
    const [first, ...rest] = face.points.map(([x, y]) => `${x} ${y}`);

    return `M${first}${rest.map((point) => `L${point}`).join("")}Z`;
  }

  static #unitViewBox(): string {
    const bounds = new THREE.Box2();
    for (const corner of ShapeGlyph.#corners(kUnitCube)) {
      bounds.expandByPoint(new THREE.Vector2(...ShapeGlyph.#project(corner)));
    }
    bounds.expandByScalar(kPadding);

    const size = bounds.getSize(new THREE.Vector2());
    const side = Math.max(size.x, size.y);
    const center = bounds.getCenter(new THREE.Vector2());

    return [
      center.x - (side / 2),
      center.y - (side / 2),
      side,
      side
    ].map(ShapeGlyph.#round).join(" ");
  }

  static* #corners(
    box: THREE.Box3
  ): IterableIterator<THREE.Vector3> {
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          yield new THREE.Vector3(x, y, z);
        }
      }
    }
  }

  static #round(
    value: number
  ): number {
    return Math.round(value * 1000) / 1000;
  }
}
