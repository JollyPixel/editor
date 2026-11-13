// Import Third-party Dependencies
import type { ConvertedAsset } from "@jolly-pixel/asset-server";
import {
  PIXEL_ART_KIND,
  pixelArtContentFromPng
} from "@jolly-pixel/asset.pixel-art";
import {
  withRotation,
  type UVGeometry
} from "@jolly-pixel/pixel-draw.renderer";
import { wrap } from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  readCsModel,
  type CsFace,
  type CsModelNode,
  type CsQuaternion,
  type CsVector3
} from "./CsModelReader.ts";
import { InvalidCsModelError } from "./errors/InvalidCsModelError.ts";
import {
  VOXEL_MODEL_FILE_VERSION,
  type VoxelModelFile
} from "../../asset/voxelModel.ts";
import { VOXEL_MODEL_FILE } from "../../asset/voxelModelFile.ts";
import type {
  BlockNodeJSON,
  MirrorAxes,
  Vector3JSON
} from "../../network/types.ts";

// CONSTANTS
export const CSMODEL_EXTENSION = ".csmodel";
const kPixelsPerUnit = 16;
const kMinThickness = 0.001;
const kTextureId = "csmodel-texture";
const kFaceSlots = ["front", "back", "right", "bottom", "left", "top"] as const;
const kQuarterTurnFlags = [[1, 1], [2, 2], [4, 3]] as const;
const kMirrorHorizontal = 8;
const kMirrorVertical = 16;
const kPngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

type FaceSlot = (typeof kFaceSlots)[number];

interface TextureSize {
  width: number;
  height: number;
}

export async function voxelModelFromCsModel(
  content: Uint8Array
): Promise<ConvertedAsset> {
  const model = readCsModel(content);
  const textureSize = pngSize(model.texture);
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const file: VoxelModelFile = {
    version: VOXEL_MODEL_FILE_VERSION,
    nodes: model.nodes.map((node) => blockNode(
      node,
      node.parentId === null ? undefined : nodes.get(node.parentId),
      textureSize
    )),
    materials: [],
    animationSets: [],
    texture: {
      id: kTextureId,
      kind: PIXEL_ART_KIND
    }
  };

  return {
    content: VOXEL_MODEL_FILE.encode(file),
    companions: [
      {
        id: kTextureId,
        kind: PIXEL_ART_KIND,
        content: await pixelArtContentFromPng(model.texture)
      }
    ]
  };
}

function blockNode(
  node: CsModelNode,
  parent: CsModelNode | undefined,
  textureSize: TextureSize
): BlockNodeJSON {
  const { stretch, size } = node;
  const parentOffset = parent?.offset ?? { x: 0, y: 0, z: 0 };
  const block: BlockNodeJSON = {
    kind: "block",
    id: nodeId(node.id),
    parentId: node.parentId === null ? null : nodeId(node.parentId),
    name: node.name,
    transform: {
      position: combine(node.position, parentOffset, (a, b) => a + b),
      pivotOffset: combine(node.offset, stretch, (offset, k) => negate(offset * k)),
      size: combine(size, stretch, (pixels, k) => Math.max(
        kMinThickness,
        pixels * Math.abs(k) / kPixelsPerUnit
      )),
      scale: { x: 1, y: 1, z: 1 },
      rotation: eulerXyz(node.orientation)
    },
    uv: {
      state: "free",
      faces: Object.fromEntries(kFaceSlots.map((slot, index) => [
        slot,
        faceRect(slot, node.faces[index], size, textureSize)
      ]))
    }
  };

  const flipAxes: MirrorAxes = {
    x: stretch.x < 0,
    y: stretch.y < 0,
    z: stretch.z < 0
  };

  return flipAxes.x || flipAxes.y || flipAxes.z ?
    {
      ...block,
      flipAxes
    } :
    block;
}

function faceRect(
  slot: FaceSlot,
  face: CsFace,
  size: CsVector3,
  textureSize: TextureSize
): UVGeometry {
  const [width, height] = faceDimensions(slot, size);
  const mirroredHorizontally = (face.flags & kMirrorHorizontal) !== 0;
  const mirroredVertically = (face.flags & kMirrorVertical) !== 0;
  const pivotTurns = clockwiseTurns(face.flags);
  const turns = pivotTurns + (mirroredVertically ? 2 : 0);
  const swapped = turns % 2 === 1;
  const [farX, farY] = quarterTurned(
    mirroredHorizontally ? -width : width,
    mirroredVertically ? -height : height,
    pivotTurns
  );
  const rect = withRotation({
    x: wrap(face.x + Math.min(0, farX), textureSize.width),
    y: wrap(face.y + Math.min(0, farY), textureSize.height),
    width: Math.max(1, swapped ? height : width),
    height: Math.max(1, swapped ? width : height)
  }, turns);

  return mirroredHorizontally === mirroredVertically ?
    rect :
    {
      ...rect,
      mirrored: true
    };
}

function faceDimensions(
  slot: FaceSlot,
  size: CsVector3
): [number, number] {
  switch (slot) {
    case "front":
    case "back":
      return [size.x, size.y];
    case "right":
    case "left":
      return [size.z, size.y];
    default:
      return [size.x, size.z];
  }
}

function clockwiseTurns(
  flags: number
): number {
  const found = kQuarterTurnFlags.find(([bit]) => (flags & bit) !== 0);

  return found === undefined ? 0 : found[1];
}

function quarterTurned(
  x: number,
  y: number,
  turns: number
): [number, number] {
  switch (turns) {
    case 1:
      return [-y, x];
    case 2:
      return [-x, -y];
    case 3:
      return [y, -x];
    default:
      return [x, y];
  }
}

function eulerXyz(
  quaternion: CsQuaternion
): Vector3JSON {
  const { w, x, y, z } = quaternion;
  const m11 = 1 - (2 * ((y * y) + (z * z)));
  const m12 = 2 * ((x * y) - (z * w));
  const m13 = 2 * ((x * z) + (y * w));
  const m22 = 1 - (2 * ((x * x) + (z * z)));
  const m23 = 2 * ((y * z) - (x * w));
  const m32 = 2 * ((y * z) + (x * w));
  const m33 = 1 - (2 * ((x * x) + (y * y)));
  const ry = Math.asin(Math.min(1, Math.max(-1, m13)));

  return Math.abs(m13) < 0.9999999 ?
    {
      x: Math.atan2(-m23, m33),
      y: ry,
      z: Math.atan2(-m12, m11)
    } :
    {
      x: Math.atan2(m32, m22),
      y: ry,
      z: 0
    };
}

function pngSize(
  png: Uint8Array
): TextureSize {
  if (
    png.byteLength < 24 ||
    kPngSignature.some((byte, index) => png[index] !== byte)
  ) {
    throw new InvalidCsModelError("the texture is not a PNG image");
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);

  return {
    width: view.getUint32(16),
    height: view.getUint32(20)
  };
}

function combine(
  a: CsVector3,
  b: CsVector3,
  merge: (a: number, b: number) => number
): Vector3JSON {
  return {
    x: merge(a.x, b.x),
    y: merge(a.y, b.y),
    z: merge(a.z, b.z)
  };
}

function negate(
  value: number
): number {
  return value === 0 ? 0 : -value;
}

function nodeId(
  id: number
): string {
  return `cs-${id}`;
}
