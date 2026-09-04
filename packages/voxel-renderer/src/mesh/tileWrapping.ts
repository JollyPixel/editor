// Import Third-party Dependencies
import type * as THREE from "three";
import {
  attribute,
  clamp,
  float,
  floor,
  reference,
  step,
  texture,
  uv,
  vec2,
  vec4
} from "three/tsl";

export type TileWrappedMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

/**
 * Confines each face's samples to its own atlas rect. MSAA can shade a
 * partially covered pixel from a point outside the triangle, whose
 * interpolated UV would otherwise read a neighbouring tile.
 */
export function enableTileClamping(
  material: TileWrappedMaterial
): void {
  const { map } = material;
  if (!map) {
    return;
  }

  const tileRegion = attribute<"vec4">("tileRegion", "vec4");
  const sampledDiffuseColor = texture(
    map,
    clamp(
      uv(),
      tileRegion.xy,
      tileRegion.xy.add(tileRegion.zw)
    )
  ).level(float(0));

  const tint = reference("color", "color", material);

  (material as { colorNode?: unknown; }).colorNode = vec4(tint, float(1))
    .mul(sampledDiffuseColor);
}

/**
 * Repeats atlas tiles across greedy quads using WebGPU-compatible TSL nodes.
 */
export function enableTileWrapping(
  material: TileWrappedMaterial
): void {
  const { map } = material;
  if (!map) {
    return;
  }

  const tileRegion = attribute<"vec4">("tileRegion", "vec4");
  // Must be declared as `uvec2` then converted: the WebGPU backend uploads it as an
  // integer attribute, so `vec2` would reinterpret the bits rather than convert them.
  const tileRepeat = vec2(attribute<"uvec2">("tileRepeat", "uvec2"));

  // Fold tile-space UVs into 0..1, while preserving the far edge.
  const tileCoord = clamp(uv(), vec2(0), tileRepeat);
  const tileFracBase = tileCoord.sub(floor(tileCoord));
  // `mix()` only exposes a scalar TS overload, so the vec2 form is expanded manually.
  const edgeMask = step(tileRepeat, tileCoord);
  const tileFrac = tileFracBase.add(vec2(1).sub(tileFracBase).mul(edgeMask));

  // Force LOD 0: the UV discontinuity at each repeat causes derivative spikes.
  const sampledDiffuseColor = texture(
    map,
    tileRegion.xy.add(tileFrac.mul(tileRegion.zw))
  ).level(float(0));

  // `materialColor` re-samples the atlas at raw UVs; read material.color directly.
  // Opacity is omitted: setupDiffuseColor() applies it after this node.
  const tint = reference("color", "color", material);

  // The WebGPU build aliases the classic material names onto their node
  // variants, so `colorNode` exists at runtime but not on the classic type.
  (material as { colorNode?: unknown; }).colorNode = vec4(tint, float(1))
    .mul(sampledDiffuseColor);
}
