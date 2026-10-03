// Import Third-party Dependencies
import type * as THREE from "three";
import type { Node } from "three/webgpu";
import {
  abs,
  clamp,
  cross,
  dFdx,
  dFdy,
  dot,
  float,
  floor,
  Fn,
  inverseSqrt,
  max,
  mix,
  normalView,
  positionView,
  reference,
  select,
  texture,
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
import {
  atlasSize,
  regionStart,
  regionTexels
} from "./atlasNodes.ts";
import {
  blendedTile,
  remapTileUv,
  type TileBlendInputs
} from "./tileBlending.ts";

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
  /**
   * Blend neighbours of a blended face; ignored by flat shading.
   */
  blend?: TileBlendInputs;
}

export interface TileShadingOptions {
  surface?: BlockSurface;
  aoStrength?: AoStrengthUniform;
  averages?: THREE.Texture | null;
  normal?: THREE.Texture | null;
  flat?: boolean;
  alphaToCoverage?: boolean;
}

interface TileColorOptions extends TileShadingOptions {
  inputs: TileInputs;
}

interface TileNormalInputs {
  map: THREE.Texture;
  uv: Vec2Node;
  texel: Vec2Node;
}

interface TileSample {
  sampled: Vec4Node;
  texel: Vec2Node;
  position: Vec2Node;
  region?: Vec4Node;
}

interface TexelBounds {
  start: Vec2Node;
  end: Vec2Node;
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

  const blend = options.flat ? undefined : inputs.blend;
  const tile = blend === undefined ?
    undefined :
    blendedTile(map, inputs.region, blend);
  const region = tile?.region ?? inputs.region;
  const uv = tile === undefined ?
    inputs.uv :
    remapTileUv(inputs.uv, inputs.region, region);
  const clamped = clamp(
    uv,
    region.xy,
    region.xy.add(region.zw)
  );
  const size = atlasSize(map);
  const texel = inputs.uv.mul(size);
  const sampled = texture(map, clamped).level(float(0));

  if (options.normal) {
    applyTileNormal(material, {
      map: options.normal,
      uv: clamped,
      texel
    });
  }
  applyTileColor(
    material,
    {
      sampled: tile === undefined ?
        sampled :
        vec4(sampled.rgb.mul(tile.shade), sampled.a),
      texel,
      position: clamped.mul(size),
      region: tile?.region
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
    const footprint = texelFootprint(sample.texel);
    diffuse = footprintAverage(
      map,
      averages,
      sample,
      sample.region === undefined ?
        varyingBounds(map, inputs.vertexRegion) :
        texelBounds(map, sample.region),
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
  bounds: TexelBounds,
  footprint: Vec2Node
): Vec4Node {
  const size = atlasSize(map);
  const { start, end } = bounds;

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

  return lerp(sample.sampled, average, minificationWeight(footprint));
}

function texelFootprint(
  texel: Vec2Node
): Vec2Node {
  return abs(dFdx(texel)).add(abs(dFdy(texel)));
}

function minificationWeight(
  footprint: Vec2Node
): FloatNode {
  return clamp(
    max(footprint.x, footprint.y).sub(1),
    float(0),
    float(1)
  );
}

function applyTileNormal(
  material: TileShadedMaterial,
  inputs: TileNormalInputs
): void {
  const { map, uv, texel } = inputs;
  const scale = reference("normalScale", "vec2", material);
  const fade = minificationWeight(texelFootprint(texel));

  (material as { normalNode?: unknown; }).normalNode = Fn(() => {
    const geometric = normalView;
    const q0 = dFdx(positionView);
    const q1 = dFdy(positionView);
    const st0 = dFdx(texel);
    const st1 = dFdy(texel);
    const q1Perp = cross(q1, geometric);
    const q0Perp = cross(geometric, q0);
    const tangent = q1Perp.mul(st0.x).add(q0Perp.mul(st1.x));
    const bitangent = q1Perp.mul(st0.y).add(q0Perp.mul(st1.y));
    const det = max(dot(tangent, tangent), dot(bitangent, bitangent));
    const frameScale = select(det.equal(0), float(0), inverseSqrt(det));

    const encoded = texture(map, uv).level(float(0)).xyz.mul(2).sub(1);
    const relief = tangent.mul(encoded.x.mul(scale.x))
      .add(bitangent.mul(encoded.y.mul(scale.y)))
      .mul(frameScale)
      .add(geometric.mul(encoded.z))
      .normalize();

    return mix(relief, geometric, fade).normalize();
  })();
}

function texelBounds(
  map: THREE.Texture,
  tileRegion: Vec4Node
): TexelBounds {
  const start = regionStart(tileRegion, atlasSize(map));

  return {
    start,
    end: start.add(regionTexels(map, tileRegion))
  };
}

function varyingBounds(
  map: THREE.Texture,
  tileRegion: Vec4Node
): TexelBounds {
  const { start, end } = texelBounds(map, tileRegion);

  return {
    start: varying(start),
    end: varying(end)
  };
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
