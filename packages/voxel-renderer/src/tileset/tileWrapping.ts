// Import Third-party Dependencies
import type * as THREE from "three";

// CONSTANTS
const kCacheKey = "jolly-pixel:tile-wrap";

const kVertexPars = `
attribute vec4 tileRegion;
attribute vec2 tileRepeat;
varying vec4 vTileRegion;
varying vec2 vTileRepeat;
`;

const kFragmentPars = `
varying vec4 vTileRegion;
varying vec2 vTileRepeat;
`;

/**
 * Replaces three's `map_fragment`. `vMapUv` counts tiles rather than atlas
 * space, so it is folded back into 0-1 and then mapped onto the tile's rect.
 *
 * The clamp keeps multisampled fragments, whose interpolated coordinates can
 * land slightly outside the quad, from wrapping around to the opposite edge of
 * the tile — the artifact the atlas gutter exists to prevent. Snapping the far
 * edge to 1 covers the other end: there `fract()` would return 0 and sample the
 * first texel of the tile instead of the last.
 */
const kMapFragment = `
#ifdef USE_MAP

	vec2 tileCoord = clamp( vMapUv, vec2( 0.0 ), vTileRepeat );
	vec2 tileFrac = tileCoord - floor( tileCoord );
	tileFrac = mix( tileFrac, vec2( 1.0 ), step( vTileRepeat, tileCoord ) );

	vec4 sampledDiffuseColor = texture2D( map, vTileRegion.xy + tileFrac * vTileRegion.zw );
	diffuseColor *= sampledDiffuseColor;

#endif
`;

/**
 * Teaches a material to repeat a single atlas tile across a quad larger than
 * one voxel, which is what makes greedy meshing possible on a tiled atlas:
 * without it a merged quad's UVs would run straight into the neighbouring tiles.
 *
 * Geometry must supply the `tileRegion` (the tile's atlas rect) and `tileRepeat`
 * (how many times it repeats on each axis) attributes `GeometryBuffer` writes in
 * `tiled` mode, and `uv` must be in tile space.
 *
 * Safe with this package's atlases because they are sampled with
 * `NearestFilter` and carry no mipmaps: the usual objection to wrapping UVs in
 * the fragment shader is the derivative discontinuity at each tile border, which
 * only shows up once mip levels are selected from those derivatives.
 *
 * Known limitation: three builds its own depth material for shadow casting and
 * would sample the atlas with the unwrapped UVs. Chunk meshes do not cast
 * shadows by default; cutout blocks would need a matching depth material first.
 */
export function enableTileWrapping(
  material: THREE.Material
): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\n${kVertexPars}`
      )
      .replace(
        "#include <uv_vertex>",
        "#include <uv_vertex>\n\tvTileRegion = tileRegion;\n\tvTileRepeat = tileRepeat;"
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\n${kFragmentPars}`
      )
      .replace(
        "#include <map_fragment>",
        kMapFragment
      );
  };

  // Without this three would reuse the program it cached for an untouched
  // material of the same type.
  material.customProgramCacheKey = () => kCacheKey;
}
