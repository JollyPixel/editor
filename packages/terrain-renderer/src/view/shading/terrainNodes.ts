// Import Third-party Dependencies
import type * as THREE from "three";
import {
  MeshStandardNodeMaterial,
  type Node,
  type TextureNode
} from "three/webgpu";
import {
  abs,
  atan,
  attribute,
  cameraPosition,
  clamp,
  cos,
  dFdx,
  dFdy,
  Discard,
  exp2,
  float,
  floor,
  Fn,
  fract,
  fwidth,
  If,
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
  texture,
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
  CHUNK_TIERS,
  type ChunkTier
} from "../../terrain/chunkTier.ts";
import {
  APRON_MARGIN,
  apronSize
} from "../textures/heightApron.ts";
import { holePyramidSize } from "../textures/holePyramid.ts";
import {
  LOOKUP_SIZE,
  OVERVIEW_TEXTURE_SIZE,
  HIGHLIGHT_FLAG,
  TIER_LAYER_STRIDE,
  type RefinedTier,
  type TierArrays
} from "../textures/ChunkTextureStore.ts";
import type { MaterialArrays } from "../textures/MaterialTextureStore.ts";
import {
  materialSurface,
  type MaterialSurfaceTextures
} from "./materialSurface.ts";
import {
  splatLayers,
  splatOverlay,
  type SplatTextures
} from "./splatLayers.ts";

// CONSTANTS
export const NODE_DATA_ATTRIBUTE = "terrainNode";
export const NODE_MORPH_ATTRIBUTE = "terrainMorph";
export const GRID_ATTRIBUTE = "terrainGrid";
export const MORPH_OFFSETS_ATTRIBUTE = "terrainMorphOffsets";
const kLineColor = vec3(0.08, 0.09, 0.07);
const kLevelTint = 0.45;
const kSlopeRampTop = Math.PI / 3;
const kSlopeFlat = vec3(0.24, 0.58, 0.32);
const kSlopeMid = vec3(0.86, 0.8, 0.26);
const kSlopeHigh = vec3(0.9, 0.48, 0.16);
const kSlopeTooSteep = vec3(0.82, 0.12, 0.12);
const kHoleColor = vec3(0.78, 0.22, 0.86);
const kHoleTint = 0.55;
const kHighlightColor = vec3(0.98, 0.75, 0.14);
const kHighlightTint = 0.4;
const kFinestTier = CHUNK_TIERS[CHUNK_TIERS.length - 1];

export const TERRAIN_OVERLAYS = ["none", "chunks", "lod", "slope", "splat", "holes"] as const;
export const DEFAULT_WALKABLE_SLOPE = 45;
export const MAX_WALKABLE_SLOPE = 90;
export type TerrainOverlay = typeof TERRAIN_OVERLAYS[number];

type BoolNode = Node<"bool">;
type FloatNode = Node<"float">;
type IntNode = Node<"int">;
type Vec2Node = Node<"vec2">;

export interface TerrainTextures extends SplatTextures, MaterialSurfaceTextures {
  heights: THREE.DataArrayTexture;
  holes: THREE.DataArrayTexture;
  refined: Readonly<Record<RefinedTier, TierArrays>>;
  lookup: THREE.DataTexture;
  overview: THREE.DataTexture;
}

export interface TerrainShading {
  material: MeshStandardNodeMaterial;
  overlay(mode: TerrainOverlay): void;
  walkableSlope(degrees: number): void;
  revealHoles(revealed: boolean): void;
  revealChunks(revealed: boolean): void;
  highlightSlot(slot: number | null): void;
  materialArrays(arrays: MaterialArrays): void;
  refinedArrays(tier: RefinedTier, arrays: TierArrays): void;
}

interface ChunkEntry {
  known: BoolNode;
  highlighted: BoolNode;
  loaded: BoolNode;
  layer: IntNode;
  tier: FloatNode;
  tierLayer: IntNode;
}

type TierTextureNodes = Readonly<Record<ChunkTier, TextureNode<"vec4">>>;

export function createTerrainShading(
  textures: TerrainTextures
): TerrainShading {
  const material = new MeshStandardNodeMaterial();

  function lookupEntry(
    chunk: Vec2Node
  ) {
    const slot = chunk.sub(floor(chunk.div(LOOKUP_SIZE)).mul(LOOKUP_SIZE));
    const entry = textureLoad(textures.lookup, ivec2(slot));
    const matches = entry.y.equal(chunk.x).and(entry.z.equal(chunk.y));

    return { entry, matches };
  }

  function chunkEntry(
    chunk: Vec2Node
  ): ChunkEntry {
    const { entry, matches } = lookupEntry(chunk);
    const loaded = entry.x.greaterThan(0.5).and(matches);
    const stride = floor(entry.x.div(TIER_LAYER_STRIDE));
    const layer = int(entry.x.sub(stride.mul(TIER_LAYER_STRIDE))).sub(1);
    const highlighted = entry.w.greaterThanEqual(HIGHLIGHT_FLAG);
    const known = select(highlighted, entry.w.sub(HIGHLIGHT_FLAG), entry.w);
    const tier = select(loaded, known, float(1));

    return {
      known: known.greaterThan(0.5).and(matches),
      highlighted: highlighted.and(matches),
      loaded,
      layer: select(loaded, layer, int(-1)),
      tier,
      tierLayer: select(loaded.not(), int(0), select(tier.lessThan(1.5), layer, int(stride)))
    };
  }

  function chunkLayer(
    chunk: Vec2Node
  ): IntNode {
    return chunkEntry(chunk).layer;
  }

  const heightNodes: TierTextureNodes = {
    1: texture(textures.heights),
    2: texture(textures.refined[2].heights),
    4: texture(textures.refined[4].heights)
  };
  const holeNodes: TierTextureNodes = {
    1: texture(textures.holes),
    2: texture(textures.refined[2].holes),
    4: texture(textures.refined[4].holes)
  };

  function tierLoad(
    nodes: TierTextureNodes,
    size: (tier: ChunkTier) => Vec2Node,
    tier: FloatNode,
    layer: IntNode,
    texel: Vec2Node
  ): FloatNode {
    function load(
      level: ChunkTier
    ): FloatNode {
      const clamped = clamp(texel, vec2(0), size(level).sub(1));

      return textureLoad(nodes[level], ivec2(clamped)).depth(layer).x;
    }

    return select(tier.greaterThan(3), load(4), select(tier.greaterThan(1.5), load(2), load(1)));
  }

  function apronExtent(
    tier: ChunkTier
  ): Vec2Node {
    return vec2(apronSize(tier));
  }

  function holeExtent(
    tier: ChunkTier
  ): Vec2Node {
    const { width, height } = holePyramidSize(tier);

    return vec2(width, height);
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
    tier: FloatNode,
    layer: IntNode,
    texel: Vec2Node
  ): FloatNode {
    return tierLoad(heightNodes, apronExtent, tier, layer, texel);
  }

  function pickEntry(
    useCorner: BoolNode,
    useLeft: BoolNode,
    useBelow: BoolNode,
    entries: { own: ChunkEntry; left: ChunkEntry; below: ChunkEntry; corner: ChunkEntry; },
    key: "tier" | "tierLayer"
  ) {
    const { own, left, below, corner } = entries;

    return select(useCorner, corner[key], select(useLeft, left[key], select(useBelow, below[key], own[key])));
  }

  function chunkHeight(
    sample: Vec2Node
  ): FloatNode {
    const chunk = floor(sample.div(CHUNK_SAMPLES));
    const local = sample.sub(chunk.mul(CHUNK_SAMPLES));
    const onX = local.x.equal(0);
    const onZ = local.y.equal(0);
    const entries = {
      own: chunkEntry(chunk),
      left: chunkEntry(chunk.sub(vec2(1, 0))),
      below: chunkEntry(chunk.sub(vec2(0, 1))),
      corner: chunkEntry(chunk.sub(vec2(1, 1)))
    };
    const { own, left, below, corner } = entries;
    const missing = own.loaded.not();
    const useLeft = missing.and(onX).and(left.loaded);
    const useBelow = missing.and(onZ).and(below.loaded).and(useLeft.not());
    const useCorner = missing
      .and(onX)
      .and(onZ)
      .and(corner.loaded)
      .and(useLeft.not())
      .and(useBelow.not());
    const shift = select(
      useCorner,
      vec2(CHUNK_SAMPLES, CHUNK_SAMPLES),
      select(useLeft, vec2(CHUNK_SAMPLES, 0), select(useBelow, vec2(0, CHUNK_SAMPLES), vec2(0)))
    );
    const tier = pickEntry(useCorner, useLeft, useBelow, entries, "tier") as FloatNode;
    const layer = pickEntry(useCorner, useLeft, useBelow, entries, "tierLayer") as IntNode;
    const position = local.add(shift);
    const seamX = own.loaded
      .and(onX)
      .and(left.known)
      .and(left.tier.lessThan(tier));
    const seamZ = own.loaded
      .and(onZ)
      .and(below.known)
      .and(below.tier.lessThan(tier));
    const resolution = vec2(select(seamZ, below.tier, tier), select(seamX, left.tier, tier));
    const grid = position.mul(resolution);
    const cell = floor(grid);
    const blend = grid.sub(cell);
    const step = vec2(tier).div(resolution);
    function gridHeight(
      dx: number,
      dz: number
    ): FloatNode {
      return loadHeight(tier, layer, cell.add(vec2(dx, dz)).mul(step).add(APRON_MARGIN));
    }

    return mix(
      mix(gridHeight(0, 0), gridHeight(1, 0), blend.x),
      mix(gridHeight(0, 1), gridHeight(1, 1), blend.x),
      blend.y
    );
  }

  function heightAt(
    sample: Vec2Node
  ): FloatNode {
    const chunk = floor(sample.div(CHUNK_SAMPLES));
    const unloaded = chunkLayer(chunk).lessThan(int(0)).and(chunkKnown(chunk));

    return select(unloaded, overviewHeight(sample), chunkHeight(sample));
  }

  const node = attribute(NODE_DATA_ATTRIBUTE, "vec4");
  const morphRange = attribute(NODE_MORPH_ATTRIBUTE, "vec3");
  const grid = attribute(GRID_ATTRIBUTE, "vec4");
  const offsets = attribute(MORPH_OFFSETS_ATTRIBUTE, "vec4");
  const spacing = node.z;

  const world = node.xy.add(grid.xy.mul(spacing));
  const sample = round(world.mul(kFinestTier)).div(kFinestTier);
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
  const fragmentEntry = chunkEntry(fragmentChunk);
  const fragmentLayer = fragmentEntry.layer;
  const fragmentTier = fragmentEntry.tier;
  const local = fragmentWorld.sub(fragmentChunk.mul(CHUNK_SAMPLES));
  const fragmentGrid = local.mul(fragmentTier);
  const base = floor(fragmentGrid);
  const blend = fragmentGrid.sub(base);

  function gradientAt(
    dx: number,
    dz: number
  ): Vec2Node {
    const texel = base.add(vec2(dx + APRON_MARGIN, dz + APRON_MARGIN));
    function load(
      offset: Vec2Node
    ): FloatNode {
      return loadHeight(fragmentTier, fragmentEntry.tierLayer, texel.add(offset));
    }
    const east = load(vec2(1, 0));
    const west = load(vec2(-1, 0));
    const north = load(vec2(0, 1));
    const south = load(vec2(0, -1));

    return vec2(east.sub(west), north.sub(south)).mul(fragmentTier.mul(0.5));
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
  const surfaceNormal = normalize(vec3(gradient.x.negate(), float(1), gradient.y.negate()));
  const tangent = normalize(vec3(1, 0, 0).sub(surfaceNormal.mul(surfaceNormal.x)));
  const bitangent = normalize(vec3(0, 0, 1).sub(surfaceNormal.mul(surfaceNormal.z)));
  const surfacePoint = vec3(fragmentWorld.x, varying(position.y, "vTerrainHeight"), fragmentWorld.y);
  const pointDx = dFdx(surfacePoint);
  const pointDy = dFdy(surfacePoint);
  const layers = splatLayers(textures, { world: fragmentWorld, local, layer: fragmentLayer });
  const surface = materialSurface(textures, {
    layers,
    normal: surfaceNormal,
    tangent,
    bitangent,
    point: surfacePoint,
    pointDx,
    pointDy
  });
  const { albedo, detail, orm } = surface;
  material.normalNode = transformNormalToView(normalize(
    tangent.mul(detail.x).add(bitangent.mul(detail.y)).add(surfaceNormal.mul(detail.z))
  ));
  material.aoNode = orm.x;
  material.roughnessNode = orm.y;
  material.metalnessNode = orm.z;
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
  const tierLevels = log2(fragmentTier);
  const holeCellSize = exp2(clamp(round(level.add(tierLevels)), 0, tierLevels.add(Math.log2(CHUNK_SAMPLES))));
  const holeCell = floor(fragmentGrid.div(holeCellSize));
  const holeWidth = fragmentTier.mul(CHUNK_SAMPLES * 2);
  const holeTexel = vec2(holeCell.x.add(holeWidth.sub(holeWidth.div(holeCellSize))), holeCell.y);
  const inHole = fragmentLayer.greaterThanEqual(int(0)).and(
    tierLoad(holeNodes, holeExtent, fragmentTier, fragmentEntry.tierLayer, holeTexel).greaterThan(0.5)
  );
  function overlayIs(
    mode: TerrainOverlay
  ) {
    return overlay.equal(TERRAIN_OVERLAYS.indexOf(mode));
  }
  const reveal = uniform(0);
  const holesShown = overlayIs("holes").or(reveal.equal(1));
  const revealGrid = uniform(0);
  const holeCellCoord = fragmentGrid.div(holeCellSize);
  const holeLineDistance = abs(fract(holeCellCoord.sub(0.5)).sub(0.5))
    .div(max(fwidth(holeCellCoord), vec2(1e-4)));
  const holeLine = float(1).sub(min(min(holeLineDistance.x, holeLineDistance.y), float(1)));
  const highlight = uniform(-1);
  const splatColor = splatOverlay(layers, highlight);
  material.colorNode = Fn(() => {
    Discard(chunkKnown(fragmentChunk).not());
    Discard(inHole.and(holesShown.not()));
    const color = albedo.toVar();
    If(overlayIs("lod"), () => {
      color.assign(mix(color, levelColor, kLevelTint));
    }).ElseIf(overlayIs("slope"), () => {
      color.assign(slopeColor);
    }).ElseIf(overlayIs("splat"), () => {
      color.assign(splatColor);
    });
    If(overlayIs("chunks").or(overlayIs("lod")).or(revealGrid.equal(1)), () => {
      color.assign(mix(color, kLineColor, line));
    });
    If(fragmentEntry.highlighted, () => {
      color.assign(mix(color, kHighlightColor, kHighlightTint));
    });
    If(inHole, () => {
      color.assign(mix(mix(color, kHoleColor, kHoleTint), kHoleColor, holeLine));
    });

    return color;
  })();

  return {
    material,
    overlay(mode) {
      overlay.value = TERRAIN_OVERLAYS.indexOf(mode);
    },
    revealHoles(revealed) {
      reveal.value = revealed ? 1 : 0;
    },
    revealChunks(revealed) {
      revealGrid.value = revealed ? 1 : 0;
    },
    walkableSlope(degrees) {
      walkable.value = degreesToRadians(degrees);
    },
    highlightSlot(slot) {
      highlight.value = slot ?? -1;
    },
    materialArrays(arrays) {
      surface.materialArrays(arrays);
    },
    refinedArrays(tier, arrays) {
      heightNodes[tier].value = arrays.heights;
      holeNodes[tier].value = arrays.holes;
    }
  };
}

function degreesToRadians(
  degrees: number
): number {
  return degrees * Math.PI / 180;
}
