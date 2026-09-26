// Import Third-party Dependencies
import type * as THREE from "three";
import type { Node } from "three/webgpu";
import {
  abs,
  attribute,
  clamp,
  dFdx,
  dFdy,
  float,
  floor,
  Fn,
  int,
  max,
  reference,
  round,
  step,
  texture,
  textureSize,
  uv,
  varying,
  vec2,
  vec4
} from "three/tsl";

// Import Internal Dependencies
import type { BlockSurface } from "../blocks/BlockSurface.ts";
import { TILE_REPEAT_SCALE } from "./GeometryBuffer.ts";
import {
  aoFactorNode,
  type AoStrengthUniform
} from "./ambientOcclusion.ts";

// CONSTANTS
const kMinimumWeight = 1e-6;

export type TileWrappedMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

type Vec2Node = Node<"vec2">;
type Vec4Node = Node<"vec4">;
type FloatNode = Node<"float">;
type TableNode = ReturnType<typeof texture<"vec4">>;

export interface TileInputs {
  uv: Vec2Node;
  region: Vec4Node;
  vertexRegion: Vec4Node;
  brightness: FloatNode;
}

export interface TileShadingOptions {
  surface?: BlockSurface;
  aoStrength?: AoStrengthUniform;
  averages?: THREE.Texture | null;
  flat?: boolean;
  alphaToCoverage?: boolean;
}

export interface TileClampingOptions extends TileShadingOptions {
  inputs?: TileInputs;
}

interface TileSample {
  sampled: Vec4Node;
  texel: Vec2Node;
  position: Vec2Node;
}

/**
 * Confines each face's samples to its own atlas rect. MSAA can shade a
 * partially covered pixel from a point outside the triangle, whose
 * interpolated UV would otherwise read a neighbouring tile.
 */
export function enableTileClamping(
  material: TileWrappedMaterial,
  options: TileClampingOptions = {}
): void {
  const { map } = material;
  if (!map) {
    return;
  }

  const inputs = options.inputs ?? attributeInputs();
  const clamped = clamp(
    inputs.uv,
    inputs.region.xy,
    inputs.region.xy.add(inputs.region.zw)
  );
  const size = atlasSize(map);

  applyTileColor(
    material,
    {
      sampled: texture(map, clamped).level(float(0)),
      texel: inputs.uv.mul(size),
      position: clamped.mul(size)
    },
    { ...options, inputs }
  );
}

function attributeInputs(): TileInputs {
  const region = attribute<"vec4">("tileRegion", "vec4");

  return {
    uv: uv(),
    region,
    vertexRegion: region,
    brightness: attribute<"vec4">("normal", "vec4").w
  };
}

/**
 * Repeats atlas tiles across greedy quads using WebGPU-compatible TSL nodes.
 */
export function enableTileWrapping(
  material: TileWrappedMaterial,
  options: TileShadingOptions = {}
): void {
  const { map } = material;
  if (!map) {
    return;
  }

  const tileRegion = attribute<"vec4">("tileRegion", "vec4");
  const tileRepeat = attribute<"vec2">("tileRepeat", "vec2")
    .mul(TILE_REPEAT_SCALE)
    .round();

  // Fold tile-space UVs into 0..1, while preserving the far edge.
  const tileCoord = clamp(uv(), vec2(0), tileRepeat);
  const tileFracBase = tileCoord.sub(floor(tileCoord));
  // `mix()` only exposes a scalar TS overload, so the vec2 form is expanded manually.
  const edgeMask = step(tileRepeat, tileCoord);
  const tileFrac = tileFracBase.add(vec2(1).sub(tileFracBase).mul(edgeMask));
  const wrapped = tileRegion.xy.add(tileFrac.mul(tileRegion.zw));

  applyTileColor(
    material,
    {
      // Force LOD 0: the UV discontinuity at each repeat causes derivative spikes.
      sampled: texture(map, wrapped).level(float(0)),
      // The unwrapped UV counts tile repeats, so it stays continuous.
      texel: uv().mul(regionTexels(map, tileRegion)),
      position: wrapped.mul(atlasSize(map))
    },
    { ...options, inputs: attributeInputs() }
  );
}

function applyTileColor(
  material: TileWrappedMaterial,
  sample: TileSample,
  options: TileClampingOptions
): void {
  const {
    surface,
    aoStrength,
    averages = null,
    flat = false,
    alphaToCoverage = false,
    inputs = attributeInputs()
  } = options;
  const { map } = material;
  let diffuse = sample.sampled;
  if (averages && map) {
    diffuse = flat ?
      varying(regionAverage(map, averages, inputs.vertexRegion)) :
      footprintAverage(map, averages, sample, inputs.vertexRegion);
  }
  const alphaMode = surface?.alphaMode ?? "opaque";
  const keepsAlpha = (alphaMode === "blend" && !flat) ||
    (alphaMode === "mask" && alphaToCoverage);

  /*
   * `materialColor` re-samples the atlas at raw UVs; read material.color directly.
   * Opacity is omitted: setupDiffuseColor() applies it after this node.
   */
  const tint = shadedTint(material, inputs.brightness, aoStrength);

  /*
   * The WebGPU build aliases the classic material names onto their node
   * variants, so `colorNode` exists at runtime but not on the classic type.
   */
  (material as { colorNode?: unknown; }).colorNode = Fn(() => {
    if (surface?.alphaMode === "mask") {
      diffuse.a.lessThan(surface.alphaCutoff).discard();
    }
    const alpha = keepsAlpha ? diffuse.a : float(1);

    return vec4(tint, float(1)).mul(vec4(diffuse.rgb, alpha));
  })();
  configureClassicAlpha(material, surface, flat);
}

function footprintAverage(
  map: THREE.Texture,
  averages: THREE.Texture,
  sample: TileSample,
  tileRegion: Vec4Node
): Vec4Node {
  const size = atlasSize(map);
  const start = varying(regionStart(tileRegion, size));
  const end = varying(regionStart(tileRegion, size).add(regionTexels(map, tileRegion)));

  const footprint = abs(dFdx(sample.texel)).add(abs(dFdy(sample.texel)));
  const half = max(footprint, float(1)).mul(0.5);
  const low = clamp(sample.position.sub(half), start, end);
  const high = clamp(sample.position.add(half), start, end);

  const table = texture<"vec4">(averages);
  const tableSize = size.add(1);
  const sum = tableAt(table, tableSize, high.x, high.y)
    .sub(tableAt(table, tableSize, low.x, high.y))
    .sub(tableAt(table, tableSize, high.x, low.y))
    .add(tableAt(table, tableSize, low.x, low.y));
  const extent = high.sub(low);
  const area = max(extent.x.mul(extent.y), float(kMinimumWeight));
  const average = vec4(
    sum.rgb.div(max(sum.a, float(kMinimumWeight))),
    sum.a.div(area)
  );

  const weight = clamp(
    max(footprint.x, footprint.y).sub(1),
    float(0),
    float(1)
  );

  return lerp(sample.sampled, average, weight);
}

function tableAt(
  table: TableNode,
  tableSize: Vec2Node,
  x: FloatNode,
  y: FloatNode
): Vec4Node {
  const x0 = floor(x);
  const y0 = floor(y);
  const fx = x.sub(x0);
  const fy = y.sub(y0);
  const x1 = x0.add(1);
  const y1 = y0.add(1);

  function tap(
    tx: FloatNode,
    ty: FloatNode
  ): Vec4Node {
    return table
      .sample(vec2(tx, ty).add(0.5).div(tableSize))
      .level(float(0));
  }

  const bottom = lerp(tap(x0, y0), tap(x1, y0), fx);
  const top = lerp(tap(x0, y1), tap(x1, y1), fx);

  return lerp(bottom, top, fy);
}

/**
 * Four summed-area taps giving the alpha-weighted average of the face rect.
 * Sampled in the vertex stage: the rect is constant across a face.
 */
function regionAverage(
  map: THREE.Texture,
  averages: THREE.Texture,
  tileRegion: Vec4Node
): Vec4Node {
  const size = atlasSize(map);
  const tableSize = size.add(1);
  const start = regionStart(tileRegion, size);
  const extent = regionTexels(map, tileRegion);
  const end = start.add(extent);
  const table = texture<"vec4">(averages);

  function corner(
    x: FloatNode,
    y: FloatNode
  ): Vec4Node {
    return table
      .sample(vec2(x, y).add(0.5).div(tableSize))
      .level(float(0));
  }

  const sum = corner(end.x, end.y)
    .sub(corner(start.x, end.y))
    .sub(corner(end.x, start.y))
    .add(corner(start.x, start.y));
  const coverage = sum.a.div(max(extent.x.mul(extent.y), float(1)));

  return vec4(sum.rgb.div(max(sum.a, float(kMinimumWeight))), coverage);
}

function regionStart(
  tileRegion: Vec4Node,
  size: Vec2Node
): Vec2Node {
  return round(tileRegion.xy.mul(size).sub(0.5));
}

/**
 * Size in texels of the face rect; `tileRegion` spans texel centres.
 */
function regionTexels(
  map: THREE.Texture,
  tileRegion: Vec4Node
): Vec2Node {
  return round(tileRegion.zw.mul(atlasSize(map)).add(1));
}

function atlasSize(
  map: THREE.Texture
): Vec2Node {
  // `@types/three` types textureSize() as an untyped node.
  const size = textureSize(texture(map, vec2(0)), int(0)) as unknown as Node<"ivec2">;

  return vec2(size);
}

function lerp(
  from: Vec4Node,
  to: Vec4Node,
  weight: FloatNode
): Vec4Node {
  return from.add(to.sub(from).mul(weight));
}

function shadedTint(
  material: TileWrappedMaterial,
  brightness: FloatNode,
  aoStrength?: AoStrengthUniform
) {
  const tint = reference("color", "color", material);

  return aoStrength === undefined ?
    tint :
    tint.mul(aoFactorNode(aoStrength, brightness));
}

function configureClassicAlpha(
  material: TileWrappedMaterial,
  surface: BlockSurface | undefined,
  flat: boolean
): void {
  if (
    !surface ||
    (surface.alphaMode === "blend" && !flat)
  ) {
    return;
  }

  const alpha = surface.alphaMode === "mask" ?
    `if (diffuseColor.a < opacity * ${surface.alphaCutoff.toFixed(8)}) discard;` :
    "";
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>\n${alpha}\ndiffuseColor.a = opacity;`
    );
  };
  /**
   * The color node holds references to this material and atlas. Classic
   * materials converted by WebGPURenderer must keep those bindings separate.
   */
  material.customProgramCacheKey = () => `${material.uuid}:${JSON.stringify(surface)}:${flat}`;
}
