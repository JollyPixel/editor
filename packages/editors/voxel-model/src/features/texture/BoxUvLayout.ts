// Import Third-party Dependencies
import type * as THREE from "three";
import {
  DEFAULT_UV_SLOTS,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";
import type { FaceRanges } from "@jolly-pixel/editor.pixel-art/mesh-texturing/index.ts";
import type { MirrorAxes } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// CONSTANTS
const kFaceVertexCount = 4;
const kNoMirror: MirrorAxes = {
  x: false,
  y: false,
  z: false
};
const kAxes = ["x", "y", "z"] as const;

const kBoxFaceStart: Record<UVSlot, number> = {
  right: 0,
  left: 4,
  top: 8,
  bottom: 12,
  front: 16,
  back: 20
};

const kSlotAxis: Record<UVSlot, keyof MirrorAxes> = {
  right: "x",
  left: "x",
  top: "y",
  bottom: "y",
  front: "z",
  back: "z"
};

const kSlotOpposite: Record<UVSlot, UVSlot> = {
  right: "left",
  left: "right",
  top: "bottom",
  bottom: "top",
  front: "back",
  back: "front"
};

const kDefaultFaceUV: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 1],
  [0, 0],
  [1, 0]
];

export class BoxUvLayout {
  readonly faceRanges: Readonly<FaceRanges>;
  #mirroredSlots: ReadonlySet<UVSlot>;

  constructor(
    axes: MirrorAxes = kNoMirror
  ) {
    this.faceRanges = Object.freeze(
      Object.fromEntries(DEFAULT_UV_SLOTS.map((slot) => {
        const vertexSlot = axes[kSlotAxis[slot]]
          ? kSlotOpposite[slot]
          : slot;

        return [
          slot,
          [
            {
              start: kBoxFaceStart[vertexSlot],
              count: kFaceVertexCount
            }
          ]
        ];
      }))
    );
    this.#mirroredSlots = new Set(
      DEFAULT_UV_SLOTS.filter((slot) => isMirroredU(slot, axes))
    );
  }

  applyDefaults(
    geometry: THREE.BufferGeometry
  ): void {
    const uv = geometry.getAttribute("uv");

    for (const slot of DEFAULT_UV_SLOTS) {
      const mirrored = this.#mirroredSlots.has(slot);
      for (let corner = 0; corner < kFaceVertexCount; corner++) {
        const [u, v] = kDefaultFaceUV[corner];
        uv.setXY(
          kBoxFaceStart[slot] + corner,
          mirrored ? 1 - u : u,
          v
        );
      }
    }
    uv.needsUpdate = true;
  }
}

function isMirroredU(
  slot: UVSlot,
  axes: MirrorAxes
): boolean {
  const ownAxis = kSlotAxis[slot];

  return kAxes
    .filter((axis) => axis !== ownAxis)
    .reduce((mirrored, axis) => mirrored !== axes[axis], false);
}
