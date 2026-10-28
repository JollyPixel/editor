// Import Third-party Dependencies
import type * as THREE from "three";
import type { Node } from "three/webgpu";
import {
  abs,
  clamp,
  dot,
  float,
  floor,
  Fn,
  fract,
  If,
  int,
  ivec2,
  Loop,
  max,
  mix,
  round,
  select,
  sin,
  step,
  textureLoad,
  vec2,
  vec3,
  vec4
} from "three/tsl";

// Import Internal Dependencies
import { CHUNK_SAMPLES } from "../../terrain/ChunkCoord.ts";
import { OVERVIEW_SPACING } from "../../terrain/OverviewMap.ts";
import { SPLAT_TEXELS } from "../../terrain/SplatMap.ts";
import { OVERVIEW_TEXTURE_SIZE } from "../textures/ChunkTextureStore.ts";
import { splatColorNode } from "./splatColors.ts";

// CONSTANTS
export const SPLAT_CHANNEL_NAMES = ["x", "y", "z", "w"] as const;
export const MIN_SPLAT_WEIGHT = 1e-3;
const kJitterFrequency = 8;
const kSplatJitter = 0.9;
const kSplatDimmed = 0.3;
const kPureWeight = 254.5 / 255;

type FloatNode = Node<"float">;
type IntNode = Node<"int">;
type Vec2Node = Node<"vec2">;
type Vec3Node = Node<"vec3">;

export interface SplatTextures {
  splatIndices: THREE.DataArrayTexture;
  splatWeights: THREE.DataArrayTexture;
  overviewMaterials: THREE.DataTexture;
}

export interface SplatFragment {
  world: Vec2Node;
  local: Vec2Node;
  layer: IntNode;
}

export interface SplatLayer {
  slot: FloatNode;
  weight: FloatNode;
}

export function splatLayers(
  textures: SplatTextures,
  { world, local, layer }: SplatFragment
): SplatLayer[] {
  const loaded = layer.greaterThanEqual(int(0));
  const splatLayer = select(loaded, layer, int(0));
  const jitter = vec2(
    valueNoise(world.mul(kJitterFrequency), vec2(12.9898, 78.233)),
    valueNoise(world.mul(kJitterFrequency), vec2(39.3468, 11.135))
  ).sub(0.5).mul(kSplatJitter);
  const splatTexel = clamp(
    floor(local.mul(SPLAT_TEXELS / CHUNK_SAMPLES).add(jitter)),
    vec2(0),
    vec2(SPLAT_TEXELS - 1)
  );
  const splatIndices = textureLoad(textures.splatIndices, ivec2(splatTexel)).depth(splatLayer);
  const splatWeights = textureLoad(textures.splatWeights, ivec2(splatTexel)).depth(splatLayer);
  const smoothWeights = Fn(() => {
    const texelSpace = local.mul(SPLAT_TEXELS / CHUNK_SAMPLES).sub(0.5).toVar();
    const cornerBase = floor(texelSpace).toVar();
    const cornerBlend = texelSpace.sub(cornerBase).toVar();
    const nearestSlots = round(splatIndices.mul(255)).toVar();
    const cornerLayer = splatLayer.toVar();
    const sum = vec4(1, 0, 0, 0).toVar();
    If(splatWeights.x.lessThan(kPureWeight), () => {
      sum.assign(vec4(0));
      Loop(4, ({ i }) => {
        const offset = vec2(float(i.mod(int(2))), float(i.div(int(2)))).toVar();
        const texel = ivec2(clamp(cornerBase.add(offset), vec2(0), vec2(SPLAT_TEXELS - 1)));
        const indices = round(textureLoad(textures.splatIndices, texel).depth(cornerLayer).mul(255)).toVar();
        const weights = textureLoad(textures.splatWeights, texel).depth(cornerLayer).toVar();
        const share = mix(float(1).sub(cornerBlend), cornerBlend, offset).toVar();
        for (const channel of SPLAT_CHANNEL_NAMES) {
          const matches = float(1).sub(step(0.5, abs(nearestSlots.sub(indices[channel]))));
          sum.addAssign(matches.mul(weights[channel]).mul(share.x.mul(share.y)));
        }
      });
    });

    return sum.mul(step(MIN_SPLAT_WEIGHT, splatWeights));
  })();
  const overviewPoint = round(world.div(OVERVIEW_SPACING));
  const overviewTexel = overviewPoint.sub(
    floor(overviewPoint.div(OVERVIEW_TEXTURE_SIZE)).mul(OVERVIEW_TEXTURE_SIZE)
  );
  const overviewSlot = textureLoad(textures.overviewMaterials, ivec2(overviewTexel)).x;
  const interpolated = dot(smoothWeights, vec4(1)).greaterThan(MIN_SPLAT_WEIGHT);

  return SPLAT_CHANNEL_NAMES.map((channel, index) => {
    const fallbackSlot = index === 0 ? overviewSlot : float(0);

    return {
      slot: round(select(loaded, splatIndices[channel], fallbackSlot).mul(255)),
      weight: select(
        loaded,
        select(interpolated, smoothWeights[channel], splatWeights[channel]),
        float(index === 0 ? 1 : 0)
      )
    };
  });
}

export function splatOverlay(
  layers: readonly SplatLayer[],
  highlight: FloatNode
): Vec3Node {
  const totalWeight = layers.reduce<FloatNode>((total, { weight }) => total.add(weight), float(0));
  const splatShare = max(totalWeight, float(MIN_SPLAT_WEIGHT));
  const splatColor = layers.reduce<Vec3Node>(
    (sum, { slot, weight }) => sum.add(splatColorNode(slot).mul(weight)),
    vec3(0)
  ).div(splatShare);
  const highlightWeight = layers.reduce<FloatNode>(
    (sum, { slot, weight }) => sum.add(select(slot.equal(highlight), weight, float(0))),
    float(0)
  ).div(splatShare);

  return select(
    highlight.lessThan(0),
    splatColor,
    splatColor.mul(mix(float(kSplatDimmed), float(1), highlightWeight))
  );
}

function valueNoise(
  point: Vec2Node,
  seed: Vec2Node
): FloatNode {
  const cell = floor(point);
  const blend = point.sub(cell);
  const ease = blend.mul(blend).mul(vec2(3).sub(blend.mul(2)));
  function corner(
    offset: Vec2Node
  ): FloatNode {
    return fract(sin(dot(cell.add(offset), seed)).mul(43758.5453));
  }

  return mix(
    mix(corner(vec2(0, 0)), corner(vec2(1, 0)), ease.x),
    mix(corner(vec2(0, 1)), corner(vec2(1, 1)), ease.x),
    ease.y
  );
}
