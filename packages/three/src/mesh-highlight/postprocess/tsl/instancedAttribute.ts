// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import { instancedBufferAttribute } from "three/tsl";

// Import Internal Dependencies
import type { TslNode } from "./tslNode.ts";

export function instancedVec3Attribute(
  attribute: THREE.InstancedBufferAttribute
): TslNode<"vec3"> {
  return instancedBufferAttribute<"vec3">(attribute, "vec3");
}

export function instancedFloatAttribute(
  attribute: THREE.InstancedBufferAttribute
): TslNode<"float"> {
  return instancedBufferAttribute<"float">(attribute, "float");
}
