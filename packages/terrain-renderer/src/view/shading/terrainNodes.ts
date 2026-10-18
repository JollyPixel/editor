// Import Third-party Dependencies
import type * as THREE from "three";
import {
  MeshStandardNodeMaterial,
  type Node
} from "three/webgpu";
import {
  attribute,
  cameraPosition,
  clamp,
  Discard,
  float,
  floor,
  Fn,
  int,
  ivec2,
  length,
  mix,
  normalize,
  round,
  select,
  textureLoad,
  transformNormalToView,
  varying,
  vec2,
  vec3
} from "three/tsl";

// Import Internal Dependencies
import { CHUNK_SAMPLES } from "../../document/ChunkCoord.ts";
import {
  APRON_MARGIN,
  APRON_SIZE
} from "../textures/HeightApronStore.ts";
import { LOOKUP_SIZE } from "../textures/ChunkTextureStore.ts";

// CONSTANTS
export const NODE_DATA_ATTRIBUTE = "terrainNode";
export const NODE_MORPH_ATTRIBUTE = "terrainMorph";
export const GRID_ATTRIBUTE = "terrainGrid";
export const MORPH_OFFSETS_ATTRIBUTE = "terrainMorphOffsets";
const kAlbedo = vec3(0.42, 0.47, 0.33);

type FloatNode = Node<"float">;
type IntNode = Node<"int">;
type Vec2Node = Node<"vec2">;

export interface TerrainTextures {
  heights: THREE.DataArrayTexture;
  lookup: THREE.DataTexture;
}

interface ChunkTexel {
  layer: IntNode;
  texel: Vec2Node;
}

export function createTerrainMaterial(
  textures: TerrainTextures
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    roughness: 0.95,
    metalness: 0
  });

  function chunkLayer(
    chunk: Vec2Node
  ): IntNode {
    const slot = chunk.sub(floor(chunk.div(LOOKUP_SIZE)).mul(LOOKUP_SIZE));
    const entry = textureLoad(textures.lookup, ivec2(slot));
    const found = entry.x.greaterThan(0.5)
      .and(entry.y.equal(chunk.x))
      .and(entry.z.equal(chunk.y));

    return select(found, int(entry.x).sub(1), int(-1));
  }

  function loadHeight(
    layer: IntNode,
    texel: Vec2Node
  ): FloatNode {
    const clamped = clamp(texel, vec2(0), vec2(APRON_SIZE - 1));

    return textureLoad(textures.heights, ivec2(clamped))
      .depth(select(layer.lessThan(int(0)), int(0), layer)).x;
  }

  function sampleTexel(
    sample: Vec2Node
  ): ChunkTexel {
    const chunk = floor(sample.div(CHUNK_SAMPLES));
    const local = sample.sub(chunk.mul(CHUNK_SAMPLES));
    const onX = local.x.equal(0);
    const onZ = local.y.equal(0);
    const left = chunkLayer(chunk.sub(vec2(1, 0)));
    const below = chunkLayer(chunk.sub(vec2(0, 1)));
    const corner = chunkLayer(chunk.sub(vec2(1, 1)));
    const own = chunkLayer(chunk);
    const missing = own.lessThan(int(0));
    const useLeft = missing
      .and(onX)
      .and(left.greaterThanEqual(int(0)));
    const useBelow = missing
      .and(onZ)
      .and(below.greaterThanEqual(int(0)))
      .and(useLeft.not());
    const useCorner = missing
      .and(onX)
      .and(onZ)
      .and(useLeft.not())
      .and(useBelow.not());
    const shift = select(
      useCorner,
      vec2(CHUNK_SAMPLES, CHUNK_SAMPLES),
      select(useLeft, vec2(CHUNK_SAMPLES, 0), select(useBelow, vec2(0, CHUNK_SAMPLES), vec2(0)))
    );

    return {
      layer: select(useCorner, corner, select(useLeft, left, select(useBelow, below, own))),
      texel: local.add(shift).add(APRON_MARGIN)
    };
  }

  function heightAt(
    sample: Vec2Node
  ): FloatNode {
    const { layer, texel } = sampleTexel(sample);

    return loadHeight(layer, texel);
  }

  const node = attribute(NODE_DATA_ATTRIBUTE, "vec4");
  const morphRange = attribute(NODE_MORPH_ATTRIBUTE, "vec2");
  const grid = attribute(GRID_ATTRIBUTE, "vec4");
  const offsets = attribute(MORPH_OFFSETS_ATTRIBUTE, "vec4");
  const spacing = node.z;

  const world = node.xy.add(grid.xy.mul(spacing));
  const sample = round(world);
  const height = heightAt(sample);
  const coarse = heightAt(sample.add(offsets.xy.mul(spacing)))
    .add(heightAt(sample.add(offsets.zw.mul(spacing))))
    .mul(0.5);
  const distance = length(cameraPosition.sub(vec3(world.x, height, world.y)));
  const morph = clamp(
    distance.sub(morphRange.x).div(morphRange.y.sub(morphRange.x)),
    0,
    1
  );
  const outward = grid.zw;
  const across = chunkLayer(floor(world.add(outward.mul(0.5)).div(CHUNK_SAMPLES)));
  const skirtDepth = select(
    length(outward).greaterThan(0).and(across.greaterThanEqual(int(0))),
    node.w,
    float(0)
  );
  const position = vec3(
    world.x,
    mix(height, coarse, morph).sub(skirtDepth),
    world.y
  );
  material.positionNode = position;
  material.castShadowPositionNode = position;

  const fragmentWorld = varying(world, "vTerrainWorld");
  const fragmentChunk = floor(fragmentWorld.div(CHUNK_SAMPLES));
  const fragmentLayer = chunkLayer(fragmentChunk);
  const local = fragmentWorld.sub(fragmentChunk.mul(CHUNK_SAMPLES));
  const base = floor(local);
  const blend = local.sub(base);

  function gradientAt(
    dx: number,
    dz: number
  ): Vec2Node {
    const texel = base.add(vec2(dx + APRON_MARGIN, dz + APRON_MARGIN));
    const east = loadHeight(fragmentLayer, texel.add(vec2(1, 0)));
    const west = loadHeight(fragmentLayer, texel.sub(vec2(1, 0)));
    const north = loadHeight(fragmentLayer, texel.add(vec2(0, 1)));
    const south = loadHeight(fragmentLayer, texel.sub(vec2(0, 1)));

    return vec2(east.sub(west), north.sub(south)).mul(0.5);
  }

  const gradient = mix(
    mix(gradientAt(0, 0), gradientAt(1, 0), blend.x),
    mix(gradientAt(0, 1), gradientAt(1, 1), blend.x),
    blend.y
  );
  material.normalNode = transformNormalToView(
    normalize(vec3(gradient.x.negate(), float(1), gradient.y.negate()))
  );
  material.colorNode = Fn(() => {
    Discard(fragmentLayer.lessThan(int(0)));

    return kAlbedo;
  })();

  return material;
}
