// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import { instancedBufferAttribute, vec3, float } from "three/tsl";

/**
 * `instancedBufferAttribute()`'s return type-checks as an untagged
 * `Node<string>` (its declared return type isn't parameterized by the
 * "vec3"/"float" type-name argument given), which TSL's fluent
 * `.lessThan()`/typed-constructor overloads can't resolve as an argument.
 * These cast the concrete node type each call actually builds at runtime,
 * same live node, just narrowed for the type checker - the same technique
 * three's own `instance()` TSL helper uses internally for `instanceColor`,
 * just aimed at a buffer that isn't it (see `InstancedHighlightMask`'s own
 * doc comment for why a dedicated attribute is used instead of
 * `instanceColor` itself).
 */
export function instancedVec3Attribute(
  attribute: THREE.InstancedBufferAttribute
): ReturnType<typeof vec3> {
  return instancedBufferAttribute(attribute, "vec3") as unknown as ReturnType<typeof vec3>;
}

export function instancedFloatAttribute(
  attribute: THREE.InstancedBufferAttribute
): ReturnType<typeof float> {
  return instancedBufferAttribute(attribute, "float") as unknown as ReturnType<typeof float>;
}
