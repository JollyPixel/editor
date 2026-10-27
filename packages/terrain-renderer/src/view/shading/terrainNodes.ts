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
  bool,
  cameraPosition,
  clamp,
  cos,
  dFdx,
  dFdy,
  Discard,
  dot,
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
  sin,
  texture,
  textureLoad,
  transformNormalToView,
  uniform,
  varying,
  vec2,
  vec3,
  vec4
} from "three/tsl";

// Import Internal Dependencies
import { CHUNK_SAMPLES } from "../../terrain/ChunkCoord.ts";
import {
  OVERVIEW_SAMPLES,
  OVERVIEW_SPACING
} from "../../terrain/OverviewMap.ts";
import { SPLAT_TEXELS } from "../../terrain/SplatMap.ts";
import { SKIRT_EDGES } from "../lod/skirtMasks.ts";
import {
  APRON_MARGIN,
  APRON_SIZE
} from "../textures/heightApron.ts";
import {
  LOOKUP_SIZE,
  OVERVIEW_TEXTURE_SIZE
} from "../textures/ChunkTextureStore.ts";
import {
  MATERIAL_MAP_BITS,
  MATERIAL_MAPS,
  MATERIAL_TECHNIQUE_BITS,
  type MaterialArrays,
  type MaterialMap,
  type MaterialTechnique
} from "../textures/MaterialTextureStore.ts";
import {
  projectedSample,
  triplanarSamples,
  triplanarWeights,
  whiteoutNormal
} from "./materialSampling.ts";

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
const kMinTiling = 1e-3;
const kMinWeight = 1e-3;
const kDefaultRoughness = 1;
const kJitterCellsPerMetre = 8;
const kSplatJitter = 0.9;
const kTriplanarStart = 0.95;
const kFlatHeight = 0.5;
const kHeightBlendDepth = 0.2;
const kWeightedSum: MapCombine = {
  planar: (sample) => sample,
  triplanar: ([side, top, front], { weights }) => side.mul(weights.x)
    .add(top.mul(weights.y))
    .add(front.mul(weights.z))
};
const kNormalCombine: MapCombine = {
  planar: (sample) => vec4(unpackNormal(sample), 1),
  triplanar: (samples, { normal, tangent, bitangent, weights }) => {
    const world = whiteoutNormal(normal, weights, [
      unpackNormal(samples[0]),
      unpackNormal(samples[1]),
      unpackNormal(samples[2])
    ]);

    return vec4(dot(world, tangent), dot(world, bitangent), dot(world, normal), 1);
  }
};

export const TERRAIN_OVERLAYS = ["none", "chunks", "lod", "slope"] as const;
export const DEFAULT_WALKABLE_SLOPE = 45;
export const MAX_WALKABLE_SLOPE = 90;
export type TerrainOverlay = typeof TERRAIN_OVERLAYS[number];

type BoolNode = Node<"bool">;
type FloatNode = Node<"float">;
type IntNode = Node<"int">;
type Vec2Node = Node<"vec2">;
type Vec3Node = Node<"vec3">;
type Vec4Node = Node<"vec4">;

interface SurfaceFrame {
  normal: Vec3Node;
  tangent: Vec3Node;
  bitangent: Vec3Node;
  weights: Vec3Node;
}

interface MapCombine {
  planar(sample: Vec4Node): Vec4Node;
  triplanar(samples: readonly [Vec4Node, Vec4Node, Vec4Node], frame: SurfaceFrame): Vec4Node;
}

export interface TerrainTextures {
  heights: THREE.DataArrayTexture;
  splatIndices: THREE.DataArrayTexture;
  splatWeights: THREE.DataArrayTexture;
  lookup: THREE.DataTexture;
  overview: THREE.DataTexture;
  overviewMaterials: THREE.DataTexture;
  materialSlots: THREE.DataTexture;
  materialArrays: MaterialArrays;
}

export interface TerrainShading {
  material: MeshStandardNodeMaterial;
  overlay(mode: TerrainOverlay): void;
  walkableSlope(degrees: number): void;
  materialArrays(arrays: MaterialArrays): void;
}

interface ChunkTexel {
  layer: IntNode;
  texel: Vec2Node;
}

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
  const surfaceNormal = normalize(vec3(gradient.x.negate(), float(1), gradient.y.negate()));
  const tangent = normalize(vec3(1, 0, 0).sub(surfaceNormal.mul(surfaceNormal.x)));
  const bitangent = normalize(vec3(0, 0, 1).sub(surfaceNormal.mul(surfaceNormal.z)));
  const surfacePoint = vec3(fragmentWorld.x, varying(position.y, "vTerrainHeight"), fragmentWorld.y);
  const pointDx = dFdx(surfacePoint);
  const pointDy = dFdy(surfacePoint);
  const steep = surfaceNormal.y.lessThan(kTriplanarStart);

  const loaded = fragmentLayer.greaterThanEqual(int(0));
  const splatLayer = select(loaded, fragmentLayer, int(0));
  const splatCell = floor(fragmentWorld.mul(kJitterCellsPerMetre));
  const jitter = vec2(
    fract(sin(dot(splatCell, vec2(12.9898, 78.233))).mul(43758.5453)),
    fract(sin(dot(splatCell, vec2(39.3468, 11.135))).mul(24634.6345))
  ).sub(0.5).mul(kSplatJitter);
  const splatTexel = clamp(
    floor(local.mul(SPLAT_TEXELS / CHUNK_SAMPLES).add(jitter)),
    vec2(0),
    vec2(SPLAT_TEXELS - 1)
  );
  const splatIndices = textureLoad(textures.splatIndices, ivec2(splatTexel)).depth(splatLayer);
  const splatWeights = textureLoad(textures.splatWeights, ivec2(splatTexel)).depth(splatLayer);
  const overviewPoint = round(fragmentWorld.div(OVERVIEW_SPACING));
  const overviewTexel = overviewPoint.sub(
    floor(overviewPoint.div(OVERVIEW_TEXTURE_SIZE)).mul(OVERVIEW_TEXTURE_SIZE)
  );
  const overviewSlot = textureLoad(textures.overviewMaterials, ivec2(overviewTexel)).x;
  const arrayNodes = {
    albedo: texture(textures.materialArrays.albedo),
    normal: texture(textures.materialArrays.normal),
    orm: texture(textures.materialArrays.orm),
    height: texture(textures.materialArrays.height)
  };
  const channels = ["x", "y", "z", "w"] as const;
  const layers = channels.map((channel, index) => {
    const fallbackSlot = index === 0 ? overviewSlot : float(0);
    const slot = int(round(select(loaded, splatIndices[channel], fallbackSlot).mul(255)));
    const entry = textureLoad(textures.materialSlots, ivec2(slot, int(0)));
    const weight = select(
      entry.x.greaterThan(0.5),
      select(loaded, splatWeights[channel], float(index === 0 ? 1 : 0)),
      float(0)
    );
    const used = weight.greaterThan(0);
    const maps = int(entry.z);
    const techniques = int(entry.w);
    const arrayLayer = int(max(entry.x.sub(1), float(0)));
    const scale = float(1).div(max(entry.y, float(kMinTiling)));
    function hasMap(
      map: MaterialMap
    ): BoolNode {
      return used.and(maps.bitAnd(int(MATERIAL_MAP_BITS[map])).notEqual(int(0)));
    }
    function uses(
      technique: MaterialTechnique
    ): BoolNode {
      return techniques.bitAnd(int(MATERIAL_TECHNIQUE_BITS[technique])).notEqual(int(0));
    }
    function surfaceMap(
      map: MaterialMap,
      fallback: Vec4Node,
      combine: MapCombine = kWeightedSum,
      when: BoolNode = hasMap(map)
    ): Vec4Node {
      return Fn(() => {
        const value = vec4(fallback).toVar();
        const enabled = when.toVar();
        const triplanar = uses("triplanar").and(steep).toVar();
        const stochastic = uses("stochastic").toVar();
        const point = surfacePoint.mul(scale).toVar();
        const dx = pointDx.mul(scale).toVar();
        const dy = pointDy.mul(scale).toVar();
        const layer = arrayLayer.toVar();
        const frame: SurfaceFrame = {
          normal: surfaceNormal.toVar(),
          tangent: tangent.toVar(),
          bitangent: bitangent.toVar(),
          weights: triplanarWeights(surfaceNormal).toVar()
        };
        function read(
          uv: Vec2Node,
          uvDx: Vec2Node,
          uvDy: Vec2Node
        ): Vec4Node {
          return arrayNodes[map].sample(uv).depth(layer).grad(uvDx, uvDy);
        }
        If(enabled, () => {
          If(triplanar, () => {
            value.assign(combine.triplanar(triplanarSamples(read, point, dx, dy, stochastic), frame));
          }).Else(() => {
            value.assign(combine.planar(projectedSample(read, point.xz, dx.xz, dy.xz, stochastic)));
          });
        });

        return value;
      })();
    }

    const heightBlend = uses("heightBlend").and(hasMap("height"));

    return {
      weight,
      used,
      heightBlend,
      height: () => surfaceMap("height", vec4(kFlatHeight), kWeightedSum, heightBlend).x,
      albedo: () => surfaceMap("albedo", vec4(kAlbedo, 1)).rgb,
      detail: () => surfaceMap("normal", vec4(0, 0, 1, 1), kNormalCombine).xyz,
      orm: () => surfaceMap("orm", vec4(1, kDefaultRoughness, 0, 1)).rgb
    };
  });
  const totalWeight = layers.reduce<FloatNode>((total, { weight }) => total.add(weight), float(0));
  const painted = totalWeight.greaterThan(kMinWeight);
  const blendWeights = Fn(() => {
    const soft = vec4From(layers.map(({ weight }) => weight)).div(max(totalWeight, float(kMinWeight)));
    const heights = vec4From(layers.map(({ height }) => height())).toVar();
    const result = soft.toVar();
    If(layers.reduce<BoolNode>((any, { heightBlend }) => any.or(heightBlend), bool(false)), () => {
      const raised = channels.map((channel, index) => select(
        layers[index].used,
        soft[channel].add(heights[channel]),
        float(-1)
      ));
      const top = raised.reduce((highest, value) => max(highest, value)).sub(kHeightBlendDepth);
      const sharp = vec4From(raised.map((value) => max(value.sub(top), float(0))));
      result.assign(sharp.div(max(sharp.x.add(sharp.y).add(sharp.z).add(sharp.w), float(kMinWeight))));
    });

    return result;
  })();
  function blended(
    pick: (layer: typeof layers[number]) => Vec3Node,
    fallback: Vec3Node
  ): Vec3Node {
    const sum = layers.reduce<Vec3Node>(
      (total, layer, index) => total.add(pick(layer).mul(blendWeights[channels[index]])),
      vec3(0)
    );

    return select(painted, sum, fallback);
  }
  const albedo = blended(({ albedo: color }) => color(), kAlbedo);
  const detail = normalize(blended(({ detail: value }) => value(), vec3(0, 0, 1)));
  material.normalNode = transformNormalToView(normalize(
    tangent.mul(detail.x).add(bitangent.mul(detail.y)).add(surfaceNormal.mul(detail.z))
  ));
  const orm = blended(({ orm: value }) => value(), vec3(1, kDefaultRoughness, 0));
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
  function overlayIs(
    mode: TerrainOverlay
  ) {
    return overlay.equal(TERRAIN_OVERLAYS.indexOf(mode));
  }
  const surfaceColor = select(
    overlayIs("lod"),
    mix(albedo, levelColor, kLevelTint),
    select(overlayIs("slope"), slopeColor, albedo)
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
    },
    materialArrays(arrays) {
      for (const map of MATERIAL_MAPS) {
        arrayNodes[map].value = arrays[map];
      }
    }
  };
}

function vec4From(
  [x, y, z, w]: FloatNode[]
): Vec4Node {
  return vec4(x, y, z, w);
}

function unpackNormal(
  sample: Vec4Node
): Vec3Node {
  return sample.rgb.mul(2).sub(1);
}

function degreesToRadians(
  degrees: number
): number {
  return degrees * Math.PI / 180;
}
