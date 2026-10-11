// Import Third-party Dependencies
import type * as THREE from "three";
import type {
  Node,
  TextureNode
} from "three/webgpu";
import {
  clamp,
  float,
  floor,
  hash,
  int,
  ivec2,
  length,
  max,
  min,
  mix,
  round,
  select,
  uint,
  vec2
} from "three/tsl";

// Import Internal Dependencies
import {
  BLEND_PATTERN_CODES,
  FACE_BLEND_OFFSETS
} from "../meshing/faceBlend.ts";
import { PULLED_BLEND_TEXELS } from "../meshing/pulling/PulledChunkGeometry.ts";
import { regionTexels } from "./atlasNodes.ts";
import { texelLoad } from "./texelLoad.ts";

// CONSTANTS
const kMinimumScale = 1e-6;
const kBayerLevels = 16;
const kHashPrimes = [73856093, 19349663, 83492791];
const kWavesPerCell = 4;
const kCoarseWeight = 0.8;
const kOctaveOffset = 17.31;
const kNoiseContrast = 1.4;
const kThresholdMargin = 0.03;
const kReachOffset = 1;
const kStraySalt = 7919;
const kStrayBlock = 2;
const kStrayChance = 0.12;
const kStrayTexels = 2;
const kHomeRank = 0.5;
const kCoveringRank = 1;
const kUpperRank = 0.75;
const kLowerRank = 0.25;
const kOutlineShade = 0.6;
const kShadowShade = 0.76;

type BoolNode = Node<"bool">;
type FloatNode = Node<"float">;
type IntNode = Node<"int">;
type Vec2Node = Node<"vec2">;
type Vec3Node = Node<"vec3">;
type Vec4Node = Node<"vec4">;

export interface TileBlendInputs {
  /**
   * Face position along its AO `u` and `v` axes, 0 to 1 across the cell.
   */
  plane: Vec2Node;
  /**
   * World cell of the face along `u`, `v` and its normal axis.
   */
  cell: Vec3Node;
  /**
   * Palette index of each `FACE_BLEND_OFFSETS` neighbour, 0 for none.
   */
  indices: readonly [Vec4Node, Vec4Node];
  palette: TextureNode;
}

export interface BlendedTile {
  region: Vec4Node;
  shade: FloatNode;
}

interface BlendCandidate {
  du: number;
  dv: number;
  tile: Vec4Node;
  width: FloatNode;
  strength: FloatNode;
  bayer: BoolNode;
  inverted: BoolNode;
  valid: BoolNode;
  rank: FloatNode;
}

interface BlendField {
  origin: Vec2Node;
  last: FloatNode;
  layer: IntNode;
  candidates: BlendCandidate[];
}

interface TexelPick {
  rank: FloatNode;
  region: Vec4Node;
}

export function blendedTile(
  map: THREE.Texture,
  region: Vec4Node,
  blend: TileBlendInputs
): BlendedTile {
  const last = max(regionTexels(map, region).x.sub(1), float(1));
  const texel = round(blend.plane.mul(last));
  const field: BlendField = {
    origin: blend.cell.xy.mul(last),
    last,
    layer: int(round(blend.cell.z)),
    candidates: FACE_BLEND_OFFSETS.map(
      ([du, dv], neighbour) => createBlendCandidate(blend, du, dv, neighbour)
    )
  };

  const centre = pickAt(field, texel, region);
  const west = pickAt(field, texel.add(vec2(-1, 0)), region).rank;
  const east = pickAt(field, texel.add(vec2(1, 0)), region).rank;
  const north = pickAt(field, texel.add(vec2(0, -1)), region).rank;
  const south = pickAt(field, texel.add(vec2(0, 1)), region).rank;
  const lowest = min(min(west, east), min(north, south));
  const litSide = max(west, north);

  return {
    region: centre.region,
    shade: select(
      lowest.lessThan(centre.rank),
      float(kOutlineShade),
      select(litSide.greaterThan(centre.rank), float(kShadowShade), float(1))
    )
  };
}

export function remapTileUv(
  uv: Vec2Node,
  from: Vec4Node,
  to: Vec4Node
): Vec2Node {
  const local = uv.sub(from.xy).div(max(from.zw, vec2(kMinimumScale)));

  return to.xy.add(local.mul(to.zw));
}

function createBlendCandidate(
  blend: TileBlendInputs,
  du: number,
  dv: number,
  neighbour: number
): BlendCandidate {
  const index = int(round(
    vectorComponent(blend.indices[neighbour >> 2], neighbour & 3)
  ));
  const column = index.mul(PULLED_BLEND_TEXELS);
  const params = texelLoad(blend.palette, ivec2(column.add(1), 0));
  const strength = params.y;
  const inverted = params.w.greaterThan(0.5);

  return {
    du,
    dv,
    tile: texelLoad(blend.palette, ivec2(column, 0)),
    width: max(params.x, float(1)),
    strength,
    bayer: params.z.greaterThan(BLEND_PATTERN_CODES.bayer - 0.5),
    inverted,
    valid: index.greaterThan(0).and(strength.greaterThan(0)),
    rank: select(
      strength.greaterThan(0.75),
      float(kCoveringRank),
      select(inverted, float(kLowerRank), float(kUpperRank))
    )
  };
}

function pickAt(
  field: BlendField,
  texel: Vec2Node,
  home: Vec4Node
): TexelPick {
  const world = field.origin.add(texel);
  const bayer = bayerThreshold(world);
  const block = floor(world.div(kStrayBlock));
  const blockWorld = block.mul(kStrayBlock).add((kStrayBlock - 1) / 2);
  const blockBayer = bayerThreshold(blockWorld);
  const stray = latticeHash(
    int(block.x),
    int(block.y),
    field.layer.add(kStraySalt)
  ).lessThan(kStrayChance);

  let best: FloatNode = float(0);
  let rank: FloatNode = float(kHomeRank);
  let region: Vec4Node = home;
  for (const candidate of field.candidates) {
    const own = computeBlendScore(field, candidate, world, bayer);
    const clump = computeBlendScore(field, candidate, blockWorld, blockBayer)
      .add(candidate.strength.mul(kStrayTexels).div(candidate.width));
    const score = select(
      candidate.valid,
      max(own, select(stray, clump, float(-1))),
      float(-1)
    );
    const wins = score.greaterThan(best);
    best = select(wins, score, best);
    rank = select(wins, candidate.rank, rank);
    region = select(wins, candidate.tile, region);
  }

  return {
    rank,
    region
  };
}

function computeBlendScore(
  field: BlendField,
  candidate: BlendCandidate,
  world: Vec2Node,
  bayer: FloatNode
): FloatNode {
  const texel = world.sub(field.origin);
  const distance = edgeDistance(
    candidate.du,
    candidate.dv,
    max(texel, vec2(0)),
    max(vec2(field.last).sub(texel), vec2(0))
  );
  const reach = max(
    distance.sub(kReachOffset).div(candidate.width),
    float(0)
  );
  const noise = noiseThreshold(
    edgeAnchor(field, candidate, world).div(field.last),
    field.layer
  );
  const pattern = select(candidate.bayer, bayer, noise);
  const threshold = select(candidate.inverted, float(1).sub(pattern), pattern);

  return candidate.strength.mul(float(1).sub(reach)).sub(threshold);
}

function edgeDistance(
  du: number,
  dv: number,
  texel: Vec2Node,
  remaining: Vec2Node
): FloatNode {
  const alongU = du > 0 ? remaining.x : texel.x;
  const alongV = dv > 0 ? remaining.y : texel.y;
  if (du === 0) {
    return alongV;
  }
  if (dv === 0) {
    return alongU;
  }

  return length(vec2(alongU, alongV));
}

function edgeAnchor(
  field: BlendField,
  candidate: BlendCandidate,
  world: Vec2Node
): Vec2Node {
  const { du, dv } = candidate;
  const u = du === 0 ? world.x : field.origin.x.add(du > 0 ? field.last : 0);
  const v = dv === 0 ? world.y : field.origin.y.add(dv > 0 ? field.last : 0);

  return vec2(u, v);
}

function noiseThreshold(
  cells: Vec2Node,
  layer: IntNode
): FloatNode {
  const position = cells.mul(kWavesPerCell);
  const coarse = valueNoise(position, layer).mul(kCoarseWeight);
  const fine = valueNoise(position.mul(2).add(kOctaveOffset), layer)
    .mul(1 - kCoarseWeight);
  const waves = coarse.add(fine)
    .sub(0.5)
    .mul(kNoiseContrast)
    .add(0.5);

  return clamp(
    waves,
    float(kThresholdMargin),
    float(1 - kThresholdMargin)
  );
}

function valueNoise(
  position: Vec2Node,
  layer: IntNode
): FloatNode {
  const origin = floor(position);
  const fraction = position.sub(origin);
  const weight = fraction.mul(fraction).mul(float(3).sub(fraction.mul(2)));
  const x = int(origin.x);
  const y = int(origin.y);
  const bottom = mix(
    latticeHash(x, y, layer),
    latticeHash(x.add(1), y, layer),
    weight.x
  );
  const top = mix(
    latticeHash(x, y.add(1), layer),
    latticeHash(x.add(1), y.add(1), layer),
    weight.x
  );

  return mix(bottom, top, weight.y);
}

function latticeHash(
  x: IntNode,
  y: IntNode,
  layer: IntNode
): FloatNode {
  const seed = uint(x).mul(uint(kHashPrimes[0]))
    .bitXor(uint(y).mul(uint(kHashPrimes[1])))
    .bitXor(uint(layer).mul(uint(kHashPrimes[2])));

  return hash(seed);
}

function bayerThreshold(
  world: Vec2Node
): FloatNode {
  const x = int(round(world.x));
  const y = int(round(world.y));
  const level = bayer2(x, y).mul(4).add(
    bayer2(x.shiftRight(int(1)), y.shiftRight(int(1)))
  );

  return float(level).add(0.5).div(kBayerLevels);
}

function bayer2(
  x: IntNode,
  y: IntNode
): IntNode {
  return x.bitXor(y)
    .bitAnd(int(1))
    .mul(2)
    .add(y.bitAnd(int(1)));
}

function vectorComponent(
  vector: Vec4Node,
  index: number
): FloatNode {
  return [vector.x, vector.y, vector.z, vector.w][index];
}
