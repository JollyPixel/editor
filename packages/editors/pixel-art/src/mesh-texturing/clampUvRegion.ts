// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  attribute,
  clamp,
  dot,
  float,
  Fn,
  int,
  materialColor,
  max,
  reference,
  texture,
  textureSize,
  uv,
  vec2,
  vec4
} from "three/tsl";
import type { Node } from "three/webgpu";

// Import Internal Dependencies
import {
  ensureUvRegionAttributes,
  UV_EDGE_ATTRIBUTE,
  UV_REGION_ATTRIBUTE
} from "./uvRegion.ts";

export type UvRegionClampedMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.NodeMaterial
>;

// CONSTANTS
const kClampedMapColor = Fn(({ material }) => {
  const map = mapOf(material);
  if (map === null) {
    return materialColor;
  }

  // @types/three declares textureSize() as an untyped Node
  const texels = textureSize(texture(map), int(0)) as unknown as Node<"ivec2">;
  const size = vec2(texels);
  const region = attribute<"vec4">(UV_REGION_ATTRIBUTE, "vec4");
  const edge = attribute<"vec3">(UV_EDGE_ATTRIBUTE, "vec3");

  const inRect = clamp(uv().mul(size), region.xy, region.zw);
  const overshoot = max(dot(edge.xy, inRect).sub(edge.z), float(0));
  const texel = clamp(
    inRect.sub(edge.xy.mul(overshoot)),
    region.xy,
    region.zw
  );
  const sampled = texture(map, texel.div(size)).level(float(0));

  return vec4(reference("color", "color", material), float(1)).mul(sampled);
});

/**
 * Keeps MSAA edge samples inside the region written by `UVGeometryBinding`.
 */
export function clampUvRegion(
  mesh: UvRegionClampedMesh
): void {
  ensureUvRegionAttributes(mesh.geometry);
  mesh.material.colorNode = kClampedMapColor();
  mesh.material.needsUpdate = true;
}

function mapOf(
  material: THREE.Material
): THREE.Texture | null {
  return "map" in material && material.map instanceof THREE.Texture ?
    material.map :
    null;
}
