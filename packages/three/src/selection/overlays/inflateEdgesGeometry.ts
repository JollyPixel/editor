// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
// Two positions within this many decimal places count as the same source
// vertex when bucketing normals - collapses the usual float noise between
// vertices a geometry generator intends as exactly coincident, without
// merging genuinely distinct vertices a small distance apart.
const kPositionKeyPrecision = 5;

/**
 * `THREE.EdgesGeometry(geometry)`, with every line vertex pushed outward by
 * `offset` along *the source geometry's own vertex normal* at that position
 * (every adjacent face's normal, averaged) - not, like a uniform
 * `object.scale` bump, away from the object's local origin.
 *
 * That distinction only matters for a non-star-convex mesh: a torus's inner
 * (hole-facing) tube surface, or a torus knot's inward-facing groove
 * surfaces, both have points whose true outward normal points *toward* the
 * object's own local origin, not away from it. Scaling the whole edges
 * geometry up from origin (`SelectionOutline`'s previous approach) pushes
 * exactly those edges *into* the solid mesh instead of off it, so they lose
 * the depth test against the surface and disappear - outline lines missing
 * specifically on a shape's concave-relative-to-origin regions. A per-vertex
 * normal offset has no such blind spot: every point moves along its own true
 * local outward direction, so it reads identically for convex and concave
 * surfaces alike (and is a no-op difference on a star-convex shape like a
 * box or sphere, where "away from origin" and "along the local normal"
 * already roughly coincide).
 *
 * Reads `geometry`'s own `normal` attribute if present; computes one on a
 * disposable clone otherwise, never mutating the caller's own geometry.
 */
export function inflateEdgesGeometry(
  geometry: THREE.BufferGeometry,
  offset: number
): THREE.BufferGeometry {
  const edges = new THREE.EdgesGeometry(geometry);
  if (offset === 0) {
    return edges;
  }

  const normalByPosition = averagedNormalsByPosition(geometry);
  const position = edges.getAttribute("position");
  const normal = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    const key = positionKey(position.getX(i), position.getY(i), position.getZ(i));
    const averaged = normalByPosition.get(key);
    // No matching source vertex - shouldn't happen, `EdgesGeometry`'s own
    // line vertices are always copies of the source geometry's - but leave
    // the point exactly where `EdgesGeometry` put it rather than guess a
    // direction if it somehow does.
    if (!averaged) {
      continue;
    }

    normal.copy(averaged).normalize();
    position.setXYZ(
      i,
      position.getX(i) + (normal.x * offset),
      position.getY(i) + (normal.y * offset),
      position.getZ(i) + (normal.z * offset)
    );
  }
  position.needsUpdate = true;

  return edges;
}

function averagedNormalsByPosition(
  geometry: THREE.BufferGeometry
): Map<string, THREE.Vector3> {
  let position = geometry.getAttribute("position");
  let normal = geometry.getAttribute("normal");

  if (!normal) {
    const withNormals = geometry.clone();
    withNormals.computeVertexNormals();
    position = withNormals.getAttribute("position");
    normal = withNormals.getAttribute("normal");
  }

  const normalByPosition = new Map<string, THREE.Vector3>();
  for (let i = 0; i < position.count; i++) {
    const key = positionKey(position.getX(i), position.getY(i), position.getZ(i));
    const vertexNormal = new THREE.Vector3(normal.getX(i), normal.getY(i), normal.getZ(i));

    const existing = normalByPosition.get(key);
    if (existing) {
      existing.add(vertexNormal);
    }
    else {
      normalByPosition.set(key, vertexNormal);
    }
  }

  return normalByPosition;
}

function positionKey(
  x: number,
  y: number,
  z: number
): string {
  return `${x.toFixed(kPositionKeyPrecision)},${y.toFixed(kPositionKeyPrecision)},${z.toFixed(kPositionKeyPrecision)}`;
}
