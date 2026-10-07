// Import Third-party Dependencies
import type * as THREE from "three";
import type {
  Node,
  TextureNode
} from "three/webgpu";
import { textureLoad } from "three/tsl";

export function texelLoad(
  value: THREE.Texture | TextureNode,
  coord: Node<"ivec2">
): TextureNode {
  const load = textureLoad(value, coord);
  load.updateMatrix = false;

  return load;
}
