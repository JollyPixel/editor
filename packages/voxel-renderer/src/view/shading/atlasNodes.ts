// Import Third-party Dependencies
import type * as THREE from "three";
import type { Node } from "three/webgpu";
import {
  int,
  round,
  texture,
  textureSize,
  vec2
} from "three/tsl";

type Vec2Node = Node<"vec2">;
type Vec4Node = Node<"vec4">;

export function atlasSize(
  map: THREE.Texture
): Vec2Node {
  // `@types/three` types textureSize() as an untyped node.
  const size = textureSize(texture(map, vec2(0)), int(0)) as unknown as Node<"ivec2">;

  return vec2(size);
}

export function regionStart(
  tileRegion: Vec4Node,
  size: Vec2Node
): Vec2Node {
  return round(tileRegion.xy.mul(size).sub(0.5));
}

/**
 * Size in texels of the face rect; `tileRegion` spans texel centres.
 */
export function regionTexels(
  map: THREE.Texture,
  tileRegion: Vec4Node
): Vec2Node {
  return round(tileRegion.zw.mul(atlasSize(map)).add(1));
}
