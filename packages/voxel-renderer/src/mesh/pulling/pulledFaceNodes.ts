// Import Third-party Dependencies
import * as THREE from "three";
import {
  NodeUpdateType,
  TextureNode,
  type Node,
  type NodeBuilder,
  type NodeFrame
} from "three/webgpu";
import {
  float,
  floor,
  Fn,
  instanceIndex,
  int,
  ivec2,
  normalLocal,
  positionGeometry,
  positionPrevious,
  textureLoad,
  textureSize,
  uint,
  varying,
  vec2,
  vec3,
  vec4
} from "three/tsl";

// Import Internal Dependencies
import type { TileInputs } from "../tileShading.ts";
import {
  FACE_TEMPLATE_TEXELS,
  FACE_TEMPLATES_PER_ROW,
  type FaceTemplateTable
} from "./FaceTemplateTable.ts";
import {
  PULLED_AO_BITS,
  PULLED_CELL_BITS,
  PULLED_TEMPLATE_BITS,
  PulledChunkGeometry
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
const kPlaceholder = new THREE.DataTexture(
  new Uint32Array(2),
  1,
  1,
  THREE.RGIntegerFormat,
  THREE.UnsignedIntType
);

type FloatNode = Node<"float">;
type Vec3Node = Node<"vec3">;
type Vec4Node = Node<"vec4">;

export interface PulledFaceNodes {
  position: Vec3Node;
  normal: Vec3Node;
  uv: Node<"vec2">;
  region: Vec4Node;
  brightness: FloatNode;
  faceBrightness: FloatNode;
}

class ChunkFaceNode extends TextureNode {
  constructor(
    value: THREE.Texture = kPlaceholder,
    uvNode: Node | null = null,
    levelNode: Node | null = null,
    biasNode: Node | null = null
  ) {
    super(value, uvNode, levelNode, biasNode);
    Object.defineProperty(this, "updateType", {
      get: () => NodeUpdateType.OBJECT,
      set: () => undefined
    });
  }

  override setup(
    builder: NodeBuilder
  ) {
    this.value = facesOf(builder.object);

    return super.setup(builder);
  }

  override update(
    frame: NodeFrame
  ): boolean | undefined {
    this.value = facesOf(frame.object);

    return super.update(frame);
  }
}

function facesOf(
  object: THREE.Object3D | null
): THREE.Texture {
  const geometry = object instanceof THREE.Mesh ? object.geometry : null;

  return geometry instanceof PulledChunkGeometry ? geometry.faces : kPlaceholder;
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

  return {
    position: vec3(
      float(cell.bitAnd(uint(kCellMask))),
      float(cell.shiftRight(uint(PULLED_CELL_BITS)).bitAnd(uint(kCellMask))),
      float(cell.shiftRight(uint(PULLED_CELL_BITS * 2)).bitAnd(uint(kCellMask)))
    ).add(local),
    normal: normal.xyz,
    uv: vec2(vertex.w, vs.dot(cornerMask)),
    region: texel(int(kRegionTexel)),
    brightness: shade(ao, local, int(normal.w)),
    faceBrightness: faceShade(ao)
  };
}

export function enableVertexPulling(
  material: THREE.Material,
  templates: FaceTemplateTable
): TileInputs {
  const nodes = pulledFaceNodes(templates);

  (material as { positionNode?: unknown; }).positionNode = Fn(() => {
    normalLocal.assign(nodes.normal);
    positionPrevious.assign(nodes.position);

    return nodes.position;
  })();
  (material as { castShadowPositionNode?: unknown; })
    .castShadowPositionNode = nodes.position;

  return {
    uv: varying(nodes.uv),
    region: varying(nodes.region),
    vertexRegion: nodes.region,
    brightness: varying(nodes.brightness),
    faceBrightness: varying(nodes.faceBrightness)
  };
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
  local: Vec3Node,
  axes: Node<"int">
): FloatNode {
  const u = local.dot(axisMask(axes.mod(int(4))));
  const v = local.dot(axisMask(axes.div(int(4))));
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
