// Import Third-party Dependencies
import type * as THREE from "three";
import type { Node } from "three/webgpu";
import {
  abs,
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
  texture,
  textureSize,
  varying,
  vec2,
  vec3,
  vec4
} from "three/tsl";

// Import Internal Dependencies
import type { BlockSurface } from "../../document/blocks/BlockSurface.ts";
import { shadowPassSwitch } from "./ShadowPassSwitchNode.ts";
import {
  aoFactorNode,
  type AoStrengthUniform
} from "./ambientOcclusionNodes.ts";

// CONSTANTS
const kMinimumWeight = 1e-6;
const kFootprintScale = 2;

export type TileShadedMaterial =
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
  faceBrightness: FloatNode;
}

export interface TileShadingOptions {
  surface?: BlockSurface;
  aoStrength?: AoStrengthUniform;
  averages?: THREE.Texture | null;
  flat?: boolean;
  alphaToCoverage?: boolean;
}

interface TileColorOptions extends TileShadingOptions {
  inputs: TileInputs;
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
export function enableTileShading(
  material: TileShadedMaterial,
  inputs: TileInputs,
  options: TileShadingOptions = {}
): void {
  const { map } = material;
  if (!map) {
    return;
  }

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
    {
      ...options,
      inputs
    }
  );
}

function applyTileColor(
  material: TileShadedMaterial,
  sample: TileSample,
  options: TileColorOptions
): void {
  const {
    surface,
    aoStrength,
    averages = null,
    flat = false,
    alphaToCoverage = false,
    inputs
  } = options;
  const { map } = material;
  let diffuse = sample.sampled;
  let brightness = inputs.brightness;
  if (averages && map && flat) {
    diffuse = varying(regionAverage(map, averages, inputs.vertexRegion));
    brightness = inputs.faceBrightness;
  }
  else if (averages && map) {
    const footprint = abs(dFdx(sample.texel)).add(abs(dFdy(sample.texel)));
    diffuse = footprintAverage(
      map,
      averages,
      sample,
      inputs.vertexRegion,
      footprint
    );
    brightness = minifiedBrightness(map, inputs, footprint);
  }
  const alphaMode = surface?.alphaMode ?? "opaque";
  const keepsAlpha = (alphaMode === "blend" && !flat) ||
    (alphaMode === "mask" && alphaToCoverage);

  /*
   * `materialColor` re-samples the atlas at raw UVs; read material.color directly.
   */
  const tint = shadedTint(material, brightness, aoStrength);

  /*
   * The WebGPU build aliases the classic material names onto their node
   * variants, so `colorNode` exists at runtime but not on the classic type.
   */
  const color = Fn(() => {
    if (surface?.alphaMode === "mask") {
      diffuse.a.lessThan(surface.alphaCutoff).discard();
    }
    const alpha = keepsAlpha ? diffuse.a : float(1);

    return vec4(tint, float(1)).mul(vec4(diffuse.rgb, alpha));
  })();
  (material as { colorNode?: unknown; }).colorNode = shadowPassSwitch(
    color,
    casterColor(sample.sampled, surface, keepsAlpha)
  );
  configureClassicAlpha(material, surface, flat);
}

function casterColor(
  sampled: Vec4Node,
  surface: BlockSurface | undefined,
  keepsAlpha: boolean
): Vec4Node {
  if (surface?.alphaMode !== "mask" && !keepsAlpha) {
    return vec4(1);
  }

  return Fn(() => {
    if (surface?.alphaMode === "mask") {
      sampled.a.lessThan(surface.alphaCutoff).discard();
    }

    return vec4(vec3(1), keepsAlpha ? sampled.a : float(1));
  })();
}

/**
 * Box-filters the face rect over `kFootprintScale` pixel footprints. A
 * one-pixel box still aliases tile borders and TRAA jitter; two pixels
 * matches the support of trilinear mipmapping.
 */
function footprintAverage(
  map: THREE.Texture,
  averages: THREE.Texture,
  sample: TileSample,
  tileRegion: Vec4Node,
  footprint: Vec2Node
): Vec4Node {
  const size = atlasSize(map);
  const start = varying(regionStart(tileRegion, size));
  const end = varying(regionStart(tileRegion, size).add(regionTexels(map, tileRegion)));

  const half = max(footprint.mul(kFootprintScale), float(1)).mul(0.5);
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

/**
 * Fades per-vertex AO to its face average by the share of the face the
 * filter box spans, so corner gradients do not alias into lines once a
 * face covers a few pixels.
 */
function minifiedBrightness(
  map: THREE.Texture,
  inputs: TileInputs,
  footprint: Vec2Node
): FloatNode {
  const faces = footprint.div(varying(regionTexels(map, inputs.vertexRegion)));
  const weight = clamp(
    max(faces.x, faces.y).mul(kFootprintScale),
    float(0),
    float(1)
  );

  return inputs.brightness.add(
    inputs.faceBrightness.sub(inputs.brightness).mul(weight)
  );
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
  material: TileShadedMaterial,
  brightness: FloatNode,
  aoStrength?: AoStrengthUniform
) {
  const tint = reference("color", "color", material);

  return aoStrength === undefined ?
    tint :
    tint.mul(aoFactorNode(aoStrength, brightness));
}

function configureClassicAlpha(
  material: TileShadedMaterial,
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
    `if (diffuseColor.a < ${surface.alphaCutoff.toFixed(8)}) discard;` :
    "";
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>\n${alpha}\ndiffuseColor.a = 1.0;`
    );
  };
  /**
   * The color node holds references to this material and atlas. Classic
   * materials converted by WebGPURenderer must keep those bindings separate.
   */
  material.customProgramCacheKey = () => `${material.uuid}:${JSON.stringify(surface)}:${flat}`;
}
