// Import Third-party Dependencies
import * as THREE from "three";
import type { Node } from "three/webgpu";
import {
  float,
  floor,
  Fn,
  instanceIndex,
  int,
  ivec2,
  modelPosition,
  normalLocal,
  positionGeometry,
  positionPrevious,
  round,
  textureLoad,
  textureSize,
  uint,
  varying,
  vec2,
  vec3,
  vec4
} from "three/tsl";

// Import Internal Dependencies
import type { TileInputs } from "../../shading/tileShading.ts";
import { ChunkTextureNode } from "./ChunkTextureNode.ts";
import {
  FACE_TEMPLATE_TEXELS,
  FACE_TEMPLATES_PER_ROW,
  type FaceTemplateTable
} from "./FaceTemplateTable.ts";
import {
  PULLED_AO_BITS,
  PULLED_BLEND_TEXELS,
  PULLED_CELL_BITS,
  PULLED_TEMPLATE_BITS,
  type PulledChunkGeometry
} from "./PulledChunkGeometry.ts";

// CONSTANTS
const kCellMask = (1 << PULLED_CELL_BITS) - 1;
const kTemplateMask = (1 << PULLED_TEMPLATE_BITS) - 1;
const kAoMask = (1 << PULLED_AO_BITS) - 1;
const kAoLevelBits = 2;
const kAoLevelMask = 0b11;
const kAoMaxLevel = 3;
const kShadeMax = 127;
const kUvTexel = 4;
const kRegionTexel = 5;
const kNormalTexel = 6;
const kBlendIndexBits = 8;
const kBlendIndexMask = (1 << kBlendIndexBits) - 1;
const kPlaceholder = new THREE.DataTexture(
  new Uint32Array(2),
  1,
  1,
  THREE.RGIntegerFormat,
  THREE.UnsignedIntType
);
const kBlendPlaceholder = new THREE.DataTexture(
  new Float32Array(PULLED_BLEND_TEXELS * 4),
  PULLED_BLEND_TEXELS,
  1,
  THREE.RGBAFormat,
  THREE.FloatType
);

type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;
type Vec3Node = Node<"vec3">;
type Vec4Node = Node<"vec4">;

export interface PulledFaceNodes {
  position: Vec3Node;
  normal: Vec3Node;
  uv: Vec2Node;
  region: Vec4Node;
  brightness: FloatNode;
  faceBrightness: FloatNode;
  /**
   * Template vertex along the face's AO `u` and `v` axes.
   */
  plane: Vec2Node;
  /**
   * World cell along `u`, `v` and the face's normal axis.
   */
  cell: Vec3Node;
  blendIndices: readonly [Vec4Node, Vec4Node];
}

class ChunkFaceNode extends ChunkTextureNode {
  constructor(
    value: THREE.Texture = kPlaceholder,
    uvNode: Node | null = null,
    levelNode: Node | null = null,
    biasNode: Node | null = null
  ) {
    super(value, uvNode, levelNode, biasNode);
  }

  protected pick(
    geometry: PulledChunkGeometry | null
  ): THREE.Texture {
    return geometry?.faces ?? kPlaceholder;
  }
}

class ChunkBlendNode extends ChunkTextureNode {
  constructor(
    value: THREE.Texture = kBlendPlaceholder,
    uvNode: Node | null = null,
    levelNode: Node | null = null,
    biasNode: Node | null = null
  ) {
    super(value, uvNode, levelNode, biasNode);
  }

  protected pick(
    geometry: PulledChunkGeometry | null
  ): THREE.Texture {
    return geometry?.blends ?? kBlendPlaceholder;
  }
}

export function pulledFaceNodes(
  templates: FaceTemplateTable
): PulledFaceNodes {
  const faces = new ChunkFaceNode();
  const face = int(instanceIndex);
  const size = textureSize(faces, int(0)) as unknown as Node<"ivec2">;
  const width = int(size.x);
  const data = textureLoad(faces, ivec2(face.mod(width), face.div(width)));
  const cell = uint(data.x);
  const packed = uint(data.y);

  const template = int(packed.bitAnd(uint(kTemplateMask)));
  const ao = packed.shiftRight(uint(PULLED_TEMPLATE_BITS)).bitAnd(uint(kAoMask));
  const flip = packed.shiftRight(uint(PULLED_TEMPLATE_BITS + PULLED_AO_BITS));
  const corner = uint(positionGeometry.x).add(flip).bitAnd(uint(3));

  const column = template.mod(int(FACE_TEMPLATES_PER_ROW))
    .mul(int(FACE_TEMPLATE_TEXELS));
  const row = template.div(int(FACE_TEMPLATES_PER_ROW));
  function texel(
    offset: Node<"int">
  ): Vec4Node {
    return textureLoad(templates.node, ivec2(column.add(offset), row));
  }

  const vertex = texel(int(corner));
  const vs = texel(int(kUvTexel));
  const normal = texel(int(kNormalTexel));
  const cornerMask = oneHot(corner);
  const local = vertex.xyz;
  const axes = int(normal.w);
  const uAxis = axisMask(axes.mod(int(4)));
  const vAxis = axisMask(axes.div(int(4)));
  const plane = vec2(local.dot(uAxis), local.dot(vAxis));
  const cellPosition = vec3(
    float(cell.bitAnd(uint(kCellMask))),
    float(cell.shiftRight(uint(PULLED_CELL_BITS)).bitAnd(uint(kCellMask))),
    float(cell.shiftRight(uint(PULLED_CELL_BITS * 2)).bitAnd(uint(kCellMask)))
  );
  const worldCell = cellPosition.add(round(modelPosition));

  return {
    position: cellPosition.add(local),
    normal: normal.xyz,
    uv: vec2(vertex.w, vs.dot(cornerMask)),
    region: texel(int(kRegionTexel)),
    brightness: shade(ao, plane),
    faceBrightness: faceShade(ao),
    plane,
    cell: vec3(
      worldCell.dot(uAxis),
      worldCell.dot(vAxis),
      worldCell.dot(vec3(1).sub(uAxis).sub(vAxis))
    ),
    blendIndices: [
      blendIndicesOf(uint(data.z)),
      blendIndicesOf(uint(data.w))
    ]
  };
}

export function enableVertexPulling(
  material: THREE.Material,
  templates: FaceTemplateTable,
  blended = false
): TileInputs {
  const nodes = pulledFaceNodes(templates);

  (material as { positionNode?: unknown; }).positionNode = Fn(() => {
    normalLocal.assign(nodes.normal);
    positionPrevious.assign(nodes.position);

    return nodes.position;
  })();
  (material as { castShadowPositionNode?: unknown; })
    .castShadowPositionNode = nodes.position;

  const inputs: TileInputs = {
    uv: varying(nodes.uv),
    region: varying(nodes.region),
    vertexRegion: nodes.region,
    brightness: varying(nodes.brightness),
    faceBrightness: varying(nodes.faceBrightness)
  };
  if (blended) {
    inputs.blend = {
      plane: varying(nodes.plane),
      cell: varying(nodes.cell),
      indices: [
        varying(nodes.blendIndices[0]),
        varying(nodes.blendIndices[1])
      ],
      palette: new ChunkBlendNode()
    };
  }

  return inputs;
}

function blendIndicesOf(
  word: Node<"uint">
): Vec4Node {
  function index(
    slot: number
  ): FloatNode {
    return float(
      word.shiftRight(uint(slot * kBlendIndexBits)).bitAnd(uint(kBlendIndexMask))
    );
  }

  return vec4(index(0), index(1), index(2), index(3));
}

function oneHot(
  index: Node<"uint">
): Vec4Node {
  return vec4(
    float(index.equal(uint(0))),
    float(index.equal(uint(1))),
    float(index.equal(uint(2))),
    float(index.equal(uint(3)))
  );
}

function shade(
  ao: Node<"uint">,
  plane: Vec2Node
): FloatNode {
  const u = plane.x;
  const v = plane.y;
  const c00 = level(ao, 0);
  const c10 = level(ao, 1);
  const c01 = level(ao, 2);
  const c11 = level(ao, 3);
  const iu = float(1).sub(u);
  const iv = float(1).sub(v);
  const mixed = iu.mul(iv).mul(c00)
    .add(u.mul(iv).mul(c10))
    .add(iu.mul(v).mul(c01))
    .add(u.mul(v).mul(c11));

  return quantizeShade(mixed);
}

/**
 * Mean of the four corner levels, the value `shade` averages to over the face.
 */
function faceShade(
  ao: Node<"uint">
): FloatNode {
  const sum = level(ao, 0)
    .add(level(ao, 1))
    .add(level(ao, 2))
    .add(level(ao, 3));

  return quantizeShade(sum.mul(0.25));
}

function quantizeShade(
  value: FloatNode
): FloatNode {
  return floor(value.mul(kShadeMax / kAoMaxLevel).add(0.5)).div(kShadeMax);
}

function level(
  ao: Node<"uint">,
  corner: number
): FloatNode {
  return float(
    ao.shiftRight(uint(corner * kAoLevelBits)).bitAnd(uint(kAoLevelMask))
  );
}

function axisMask(
  axis: Node<"int">
): Vec3Node {
  return vec3(
    float(axis.equal(int(0))),
    float(axis.equal(int(1))),
    float(axis.equal(int(2)))
  );
}
