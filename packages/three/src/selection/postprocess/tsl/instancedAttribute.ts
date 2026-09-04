// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import { instancedBufferAttribute } from "three/tsl";

// Import Internal Dependencies
import type { TslNode } from "./tslNode.ts";

/**
 * `instancedBufferAttribute()`'s declared return type is generic over its
 * `type` argument, but that argument isn't declared `const`, so passing
 * the literal `"vec3"`/`"float"` still widens to a plain `Node<string>`
 * instead of `Node<"vec3">`/`Node<"float">`, which TSL's fluent
 * `.lessThan()`/typed-constructor overloads can't resolve. This asserts
 * the concrete node type each call actually builds at runtime, same live
 * node, just narrowed for the type checker - same technique three's own
 * `instance()` helper uses for `instanceColor`, aimed at a buffer that
 * isn't it (see `InstancedHighlightMask` for why).
 */
export function instancedVec3Attribute(
  attribute: THREE.InstancedBufferAttribute
): TslNode<"vec3"> {
  return instancedBufferAttribute(attribute, "vec3") as TslNode<"vec3">;
}

export function instancedFloatAttribute(
  attribute: THREE.InstancedBufferAttribute
): TslNode<"float"> {
  return instancedBufferAttribute(attribute, "float") as TslNode<"float">;
}
