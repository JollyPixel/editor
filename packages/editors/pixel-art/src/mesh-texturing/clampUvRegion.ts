// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  attribute,
  clamp,
  dot,
  float,
  floor,
  int,
  max,
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
import { MaterialTintNode } from "./MaterialTintNode.ts";

export type UvRegionClampedMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.NodeMaterial & {
    map: THREE.Texture | null;
  }
>;

// CONSTANTS
const kClampedMapColors = new WeakMap<THREE.Texture, Node<"vec4">>();
const kTint = new MaterialTintNode();

export function clampUvRegion(
  mesh: UvRegionClampedMesh,
  map: THREE.Texture | null
): void {
  ensureUvRegionAttributes(mesh.geometry);
  mesh.material.map = map;
  mesh.material.colorNode = clampedMapColor(map);
  mesh.material.needsUpdate = true;
}

function clampedMapColor(
  map: THREE.Texture | null
): Node<"vec3"> | Node<"vec4"> {
  if (map === null) {
    return kTint;
  }

  let colorNode = kClampedMapColors.get(map);
  if (colorNode === undefined) {
    colorNode = sampleClamped(map);
    kClampedMapColors.set(map, colorNode);
  }

  return colorNode;
}

function sampleClamped(
  map: THREE.Texture
): Node<"vec4"> {
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
  const wrapped = texel.sub(floor(texel.div(size)).mul(size));
  const sampled = texture(map, wrapped.div(size)).level(float(0));

  return vec4(kTint, float(1)).mul(sampled);
}
