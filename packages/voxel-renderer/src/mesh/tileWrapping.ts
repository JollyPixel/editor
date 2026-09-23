// Import Third-party Dependencies
import type * as THREE from "three";
import type { Node } from "three/webgpu";
import {
  attribute,
  clamp,
  dFdx,
  dFdy,
  float,
  floor,
  Fn,
  int,
  length,
  log2,
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

export type TileWrappedMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

type Vec2Node = Node<"vec2">;
type Vec4Node = Node<"vec4">;

/**
 * Confines each face's samples to its own atlas rect. MSAA can shade a
 * partially covered pixel from a point outside the triangle, whose
 * interpolated UV would otherwise read a neighbouring tile.
 *
 * With `averages` (an `AtlasAverages` table), distant faces fade to the
 * average colour of their rect instead of aliasing.
 */
export function enableTileClamping(
  material: TileWrappedMaterial,
  surface?: BlockSurface,
  aoStrength?: AoStrengthUniform,
  averages?: THREE.Texture | null
): void {
  const { map } = material;
  if (!map) {
    return;
  }

  const tileRegion = attribute<"vec4">("tileRegion", "vec4");
  const sampled = texture(
    map,
    clamp(
      uv(),
      tileRegion.xy,
      tileRegion.xy.add(tileRegion.zw)
    )
  ).level(float(0));

  applyTileColor(
    material,
    sampled,
    uv().mul(atlasSize(map)),
    surface,
    aoStrength,
    averages
  );
}

/**
 * Repeats atlas tiles across greedy quads using WebGPU-compatible TSL nodes.
 * `averages` behaves as in `enableTileClamping()`.
 */
export function enableTileWrapping(
  material: TileWrappedMaterial,
  surface?: BlockSurface,
  aoStrength?: AoStrengthUniform,
  averages?: THREE.Texture | null
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

  // Force LOD 0: the UV discontinuity at each repeat causes derivative spikes.
  const sampled = texture(
    map,
    tileRegion.xy.add(tileFrac.mul(tileRegion.zw))
  ).level(float(0));

  // The unwrapped UV counts tile repeats, so it stays continuous.
  applyTileColor(
    material,
    sampled,
    uv().mul(regionTexels(map, tileRegion)),
    surface,
    aoStrength,
    averages
  );
}

// eslint-disable-next-line max-params
function applyTileColor(
  material: TileWrappedMaterial,
  sampled: Vec4Node,
  texelCoord: Vec2Node,
  surface?: BlockSurface,
  aoStrength?: AoStrengthUniform,
  averages?: THREE.Texture | null
): void {
  const { map } = material;
  const diffuse = averages && map ?
    fadeToAverage(map, averages, sampled, texelCoord) :
    sampled;

  /*
   * `materialColor` re-samples the atlas at raw UVs; read material.color directly.
   * Opacity is omitted: setupDiffuseColor() applies it after this node.
   */
  const tint = shadedTint(material, aoStrength);

  /*
   * The WebGPU build aliases the classic material names onto their node
   * variants, so `colorNode` exists at runtime but not on the classic type.
   */
  (material as { colorNode?: unknown; }).colorNode = Fn(() => {
    // The level 0 alpha keeps cutout silhouettes stable at any distance.
    if (surface?.alphaMode === "mask") {
      sampled.a.lessThan(surface.alphaCutoff).discard();
    }
    const alpha = surface && surface.alphaMode !== "blend" ?
      float(1) : diffuse.a;

    return vec4(tint, float(1)).mul(vec4(diffuse.rgb, alpha));
  })();
  configureClassicAlpha(material, surface);
}

/**
 * Blends the level 0 sample toward the face rect's average colour as one
 * screen pixel covers more texels, reaching it when the pixel covers the
 * whole rect: the two ends of a mip chain, without mipmaps.
 */
function fadeToAverage(
  map: THREE.Texture,
  averages: THREE.Texture,
  sampled: Vec4Node,
  texelCoord: Vec2Node
): Vec4Node {
  const tileRegion = attribute<"vec4">("tileRegion", "vec4");
  const texels = varying(regionTexels(map, tileRegion));
  const average = varying(regionAverage(map, averages, tileRegion));

  const footprint = max(
    length(dFdx(texelCoord)),
    length(dFdy(texelCoord))
  );
  const level = log2(max(footprint, float(1)));
  const lastLevel = log2(max(max(texels.x, texels.y), float(2)));
  const weight = clamp(level.div(lastLevel), float(0), float(1));

  // `mix()` only exposes a scalar TS overload, so the vec4 form is expanded manually.
  return sampled.add(average.sub(sampled).mul(weight));
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
  const start = round(tileRegion.xy.mul(size).sub(0.5));
  const extent = regionTexels(map, tileRegion);
  const end = start.add(extent);

  function corner(
    x: Node<"float">,
    y: Node<"float">
  ): Vec4Node {
    return texture(
      averages,
      vec2(x, y).add(0.5).div(tableSize)
    ).level(float(0));
  }

  const sum = corner(end.x, end.y)
    .sub(corner(start.x, end.y))
    .sub(corner(end.x, start.y))
    .add(corner(start.x, start.y));
  const coverage = sum.a.div(max(extent.x.mul(extent.y), float(1)));

  return vec4(sum.rgb.div(max(sum.a, float(1e-6))), coverage);
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
  const size = textureSize(texture(map), int(0)) as unknown as Node<"ivec2">;

  return vec2(size);
}
function shadedTint(
  material: TileWrappedMaterial,
  aoStrength?: AoStrengthUniform
) {
  const tint = reference("color", "color", material);

  return aoStrength === undefined ? tint : tint.mul(aoFactorNode(aoStrength));
}

function configureClassicAlpha(
  material: TileWrappedMaterial,
  surface?: BlockSurface
): void {
  if (
    !surface ||
    surface.alphaMode === "blend"
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
  material.customProgramCacheKey = () => `${material.uuid}:${JSON.stringify(surface)}`;
}
