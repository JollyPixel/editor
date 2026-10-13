// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kDegenerateLength = 1e-12;
const kMinMiterCosine = 0.25;

export interface ContourChain {
  points: THREE.Vector3[];
  outwards: THREE.Vector3[];
  closed: boolean;
}

export interface ContourRing {
  offset: number;
  thickness: number;
}

export function contourTube(
  chains: Iterable<ContourChain>,
  ring: ContourRing
): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const chain of chains) {
    pushTube(positions, chain, ring);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  return geometry;
}

function pushTube(
  positions: number[],
  chain: ContourChain,
  ring: ContourRing
): void {
  const { points, outwards, closed } = chain;
  const count = outwards.length;
  const directions = outwards.map((_, index) => new THREE.Vector3()
    .subVectors(points[(index + 1) % points.length], points[index])
    .normalize());
  const sections = points.map((point, index) => {
    const before = closed || index > 0 ? (index + count - 1) % count : index;
    const after = index < count ? index : before;

    return crossSection(
      point,
      [directions[before], directions[after]],
      [outwards[before], outwards[after]],
      ring
    );
  });

  for (let index = 0; index < count; index++) {
    const start = sections[index];
    const end = sections[(index + 1) % sections.length];
    for (let corner = 0; corner < 4; corner++) {
      const next = (corner + 1) % 4;
      pushTriangle(positions, start[corner], start[next], end[next]);
      pushTriangle(positions, start[corner], end[next], end[corner]);
    }
  }

  if (!closed) {
    const [a, b, c, d] = sections[0];
    pushTriangle(positions, a, c, b);
    pushTriangle(positions, a, d, c);
    const [e, f, g, h] = sections[sections.length - 1];
    pushTriangle(positions, e, f, g);
    pushTriangle(positions, e, g, h);
  }
}

function crossSection(
  point: THREE.Vector3,
  [before, after]: readonly [THREE.Vector3, THREE.Vector3],
  [outwardBefore, outwardAfter]: readonly [THREE.Vector3, THREE.Vector3],
  ring: ContourRing
): THREE.Vector3[] {
  const tangent = new THREE.Vector3().addVectors(before, after);
  if (tangent.lengthSq() <= kDegenerateLength) {
    tangent.copy(after);
  }
  tangent.normalize();

  const outward = new THREE.Vector3().addVectors(outwardBefore, outwardAfter);
  outward.addScaledVector(tangent, -outward.dot(tangent));
  if (outward.lengthSq() <= kDegenerateLength) {
    outward.copy(outwardAfter);
  }
  outward.normalize();
  const side = new THREE.Vector3().crossVectors(tangent, outward);

  const turn = new THREE.Vector3().subVectors(after, before);
  const hasTurn = turn.lengthSq() > kDegenerateLength;
  turn.normalize();
  const miter = 1 / Math.max(before.dot(tangent), kMinMiterCosine);

  const inner = ring.offset;
  const outer = ring.offset + ring.thickness;
  const half = ring.thickness / 2;

  return [[inner, -half], [outer, -half], [outer, half], [inner, half]].map(([along, across]) => {
    const offset = new THREE.Vector3()
      .addScaledVector(outward, along)
      .addScaledVector(side, across);
    if (hasTurn) {
      offset.addScaledVector(turn, offset.dot(turn) * (miter - 1));
    }

    return offset.add(point);
  });
}

function pushTriangle(
  positions: number[],
  ...corners: THREE.Vector3[]
): void {
  for (const corner of corners) {
    positions.push(corner.x, corner.y, corner.z);
  }
}
