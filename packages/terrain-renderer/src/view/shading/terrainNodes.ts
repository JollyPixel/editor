// Import Third-party Dependencies
import type * as THREE from "three";
import {
  MeshStandardNodeMaterial,
  type Node
} from "three/webgpu";
import {
  abs,
  atan,
  attribute,
  cameraPosition,
  clamp,
  cos,
  Discard,
  float,
  floor,
  Fn,
  fract,
  fwidth,
  int,
  ivec2,
  length,
  log2,
  max,
  min,
  mix,
  normalize,
  round,
  select,
  textureLoad,
  transformNormalToView,
  uniform,
  varying,
  vec2,
  vec3
} from "three/tsl";

// Import Internal Dependencies
import { CHUNK_SAMPLES } from "../../terrain/ChunkCoord.ts";
import {
  OVERVIEW_SAMPLES,
  OVERVIEW_SPACING
} from "../../terrain/OverviewMap.ts";
import { SKIRT_EDGES } from "../lod/skirtMasks.ts";
import {
  APRON_MARGIN,
  APRON_SIZE
} from "../textures/heightApron.ts";
import {
  LOOKUP_SIZE,
  OVERVIEW_TEXTURE_SIZE
} from "../textures/ChunkTextureStore.ts";

// CONSTANTS
export const NODE_DATA_ATTRIBUTE = "terrainNode";
export const NODE_MORPH_ATTRIBUTE = "terrainMorph";
export const GRID_ATTRIBUTE = "terrainGrid";
export const MORPH_OFFSETS_ATTRIBUTE = "terrainMorphOffsets";
const kAlbedo = vec3(0.42, 0.47, 0.33);
const kLineColor = vec3(0.08, 0.09, 0.07);
const kLevelTint = 0.45;
const kSlopeRampTop = Math.PI / 3;
const kSlopeFlat = vec3(0.24, 0.58, 0.32);
const kSlopeMid = vec3(0.86, 0.8, 0.26);
const kSlopeHigh = vec3(0.9, 0.48, 0.16);
const kSlopeTooSteep = vec3(0.82, 0.12, 0.12);

export const TERRAIN_OVERLAYS = ["none", "chunks", "lod", "slope"] as const;
export const DEFAULT_WALKABLE_SLOPE = 45;
export const MAX_WALKABLE_SLOPE = 90;
export type TerrainOverlay = typeof TERRAIN_OVERLAYS[number];

type BoolNode = Node<"bool">;
type FloatNode = Node<"float">;
type IntNode = Node<"int">;
type Vec2Node = Node<"vec2">;

export interface TerrainTextures {
  heights: THREE.DataArrayTexture;
  lookup: THREE.DataTexture;
  overview: THREE.DataTexture;
}

export interface TerrainShading {
  material: MeshStandardNodeMaterial;
  overlay(mode: TerrainOverlay): void;
  walkableSlope(degrees: number): void;
}

interface ChunkTexel {
  layer: IntNode;
  texel: Vec2Node;
}

export function createTerrainShading(
  textures: TerrainTextures
): TerrainShading {
  const material = new MeshStandardNodeMaterial({
    roughness: 0.95,
    metalness: 0
  });

  function lookupEntry(
    chunk: Vec2Node
  ) {
    const slot = chunk.sub(floor(chunk.div(LOOKUP_SIZE)).mul(LOOKUP_SIZE));
    const entry = textureLoad(textures.lookup, ivec2(slot));
    const matches = entry.y.equal(chunk.x).and(entry.z.equal(chunk.y));

    return { entry, matches };
  }

  function chunkLayer(
    chunk: Vec2Node
  ): IntNode {
    const { entry, matches } = lookupEntry(chunk);

    return select(entry.x.greaterThan(0.5).and(matches), int(entry.x).sub(1), int(-1));
  }

  function chunkKnown(
    chunk: Vec2Node
  ): BoolNode {
    const { entry, matches } = lookupEntry(chunk);

    return entry.w.greaterThan(0.5).and(matches);
  }

  function overviewHeight(
    sample: Vec2Node
  ): FloatNode {
    const position = sample.div(OVERVIEW_SPACING);
    const grid = floor(position);
    const blend = position.sub(grid);
    function corner(
      offset: Vec2Node
    ): { known: BoolNode; height: FloatNode; } {
      const point = grid.add(offset);
      const texel = point.sub(floor(point.div(OVERVIEW_TEXTURE_SIZE)).mul(OVERVIEW_TEXTURE_SIZE));

      return {
        known: chunkKnown(floor(point.div(OVERVIEW_SAMPLES))),
        height: textureLoad(textures.overview, ivec2(texel)).x
      };
    }
    const base = corner(vec2(0, 0)).height;
    function cornerHeight(
      offset: Vec2Node
    ): FloatNode {
      const { known, height } = corner(offset);

      return select(known, height, base);
    }

    return mix(
      mix(base, cornerHeight(vec2(1, 0)), blend.x),
      mix(cornerHeight(vec2(0, 1)), cornerHeight(vec2(1, 1)), blend.x),
      blend.y
    );
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
    const chunk = floor(sample.div(CHUNK_SAMPLES));
    const unloaded = chunkLayer(chunk).lessThan(int(0)).and(chunkKnown(chunk));

    return select(unloaded, overviewHeight(sample), loadHeight(layer, texel));
  }

  const node = attribute(NODE_DATA_ATTRIBUTE, "vec4");
  const morphRange = attribute(NODE_MORPH_ATTRIBUTE, "vec3");
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
  const across = chunkKnown(floor(world.add(outward.mul(0.5)).div(CHUNK_SAMPLES)));
  const edgeBit = SKIRT_EDGES.reduceRight<FloatNode>(
    (otherwise, { bit, outward: [outX, outZ] }) => select(
      outward.x.equal(outX).and(outward.y.equal(outZ)),
      float(bit),
      otherwise
    ),
    float(0)
  );
  const edgeSkirted = edgeBit.greaterThan(0)
    .and(floor(morphRange.z.div(max(edgeBit, float(1)))).mod(2).greaterThan(0.5));
  const skirtDepth = select(
    edgeSkirted.and(across),
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

  const overviewGradient = vec2(
    overviewHeight(fragmentWorld.add(vec2(1, 0))).sub(overviewHeight(fragmentWorld.sub(vec2(1, 0)))),
    overviewHeight(fragmentWorld.add(vec2(0, 1))).sub(overviewHeight(fragmentWorld.sub(vec2(0, 1))))
  ).mul(0.5);
  const gradient = select(
    fragmentLayer.lessThan(int(0)),
    overviewGradient,
    mix(
      mix(gradientAt(0, 0), gradientAt(1, 0), blend.x),
      mix(gradientAt(0, 1), gradientAt(1, 1), blend.x),
      blend.y
    )
  );
  material.normalNode = transformNormalToView(
    normalize(vec3(gradient.x.negate(), float(1), gradient.y.negate()))
  );
  const overlay = uniform(0);
  const walkable = uniform(degreesToRadians(DEFAULT_WALKABLE_SLOPE));
  const slope = atan(length(gradient));
  const slopeRamp = clamp(slope.div(kSlopeRampTop), 0, 1).mul(2);
  const slopeColor = select(
    slope.greaterThan(walkable),
    kSlopeTooSteep,
    mix(mix(kSlopeFlat, kSlopeMid, clamp(slopeRamp, 0, 1)), kSlopeHigh, clamp(slopeRamp.sub(1), 0, 1))
  );
  const chunkCoord = fragmentWorld.div(CHUNK_SAMPLES);
  const lineDistance = abs(fract(chunkCoord.sub(0.5)).sub(0.5))
    .div(max(fwidth(chunkCoord), vec2(1e-4)));
  const line = float(1).sub(min(min(lineDistance.x, lineDistance.y), float(1)));
  const level = log2(varying(spacing, "vTerrainSpacing"));
  const levelColor = cos(level.mul(1.1).add(vec3(0, 2.1, 4.2))).mul(0.5).add(0.5);
  function overlayIs(
    mode: TerrainOverlay
  ) {
    return overlay.equal(TERRAIN_OVERLAYS.indexOf(mode));
  }
  const surfaceColor = select(
    overlayIs("lod"),
    mix(kAlbedo, levelColor, kLevelTint),
    select(overlayIs("slope"), slopeColor, kAlbedo)
  );
  const showLines = overlayIs("chunks").or(overlayIs("lod"));
  material.colorNode = Fn(() => {
    Discard(chunkKnown(fragmentChunk).not());

    return mix(surfaceColor, kLineColor, line.mul(select(showLines, float(1), float(0))));
  })();

  return {
    material,
    overlay(mode) {
      overlay.value = TERRAIN_OVERLAYS.indexOf(mode);
    },
    walkableSlope(degrees) {
      walkable.value = degreesToRadians(degrees);
    }
  };
}

function degreesToRadians(
  degrees: number
): number {
  return degrees * Math.PI / 180;
}
