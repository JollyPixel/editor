// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { ContourChain } from "./contourTube.ts";

// CONSTANTS
const kWeldPrecision = 1e4;
const kDegenerateArea = 1e-12;

interface ContourFace {
  normal: THREE.Vector3;
  distance: number;
}

interface ContourEdge {
  from: number;
  to: number;
  faces: number[];
  outward: THREE.Vector3;
}

interface EdgeWalk {
  vertices: number[];
  edges: ContourEdge[];
}

export class MeshContour {
  #vertices: THREE.Vector3[] = [];
  #faces: ContourFace[] = [];
  #edges: ContourEdge[] = [];

  constructor(
    geometry: THREE.BufferGeometry
  ) {
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    const welded = new Map<string, number>();
    const weldVertex = (source: number): number => {
      const point = new THREE.Vector3().fromBufferAttribute(position, source);
      const key = [point.x, point.y, point.z]
        .map((value) => Math.round(value * kWeldPrecision))
        .join(",");
      let vertex = welded.get(key);
      if (vertex === undefined) {
        vertex = this.#vertices.push(point) - 1;
        welded.set(key, vertex);
      }

      return vertex;
    };

    const edgeByKey = new Map<string, ContourEdge>();
    const count = index?.count ?? position.count;
    for (let corner = 0; corner + 2 < count; corner += 3) {
      const triangle = [0, 1, 2].map((offset) => weldVertex(index?.getX(corner + offset) ?? corner + offset));
      const [a, b, c] = triangle.map((vertex) => this.#vertices[vertex]);
      const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (normal.lengthSq() <= kDegenerateArea) {
        continue;
      }
      normal.normalize();
      const face = this.#faces.push({ normal, distance: normal.dot(a) }) - 1;

      for (let side = 0; side < 3; side++) {
        const from = triangle[side];
        const to = triangle[(side + 1) % 3];
        const opposite = this.#vertices[triangle[(side + 2) % 3]];
        const key = from < to ? `${from}:${to}` : `${to}:${from}`;
        let edge = edgeByKey.get(key);
        if (edge === undefined) {
          edge = { from, to, faces: [], outward: new THREE.Vector3() };
          edgeByKey.set(key, edge);
          this.#edges.push(edge);
        }
        edge.faces.push(face);
        edge.outward.add(this.#awayFrom(from, to, normal, opposite));
      }
    }

    for (const edge of this.#edges) {
      if (edge.outward.lengthSq() <= kDegenerateArea) {
        edge.outward.copy(this.#faces[edge.faces[0]].normal);
      }
      edge.outward.normalize();
    }
  }

  contourFrom(
    localCameraPosition: THREE.Vector3
  ): number[] {
    const facing = this.#faces.map(
      ({ normal, distance }) => normal.dot(localCameraPosition) > distance
    );

    return this.#edges.flatMap((edge, index) => {
      const front = edge.faces.filter((face) => facing[face]).length;
      const isContour = edge.faces.length === 1 || (front > 0 && front < edge.faces.length);

      return isContour ? [index] : [];
    });
  }

  chains(
    contour: readonly number[]
  ): ContourChain[] {
    const edgesAt = new Map<number, ContourEdge[]>();
    for (const index of contour) {
      const edge = this.#edges[index];
      for (const vertex of [edge.from, edge.to]) {
        edgesAt.set(vertex, [...edgesAt.get(vertex) ?? [], edge]);
      }
    }

    const used = new Set<ContourEdge>();
    const chains: ContourChain[] = [];
    for (const index of contour) {
      const edge = this.#edges[index];
      if (used.has(edge)) {
        continue;
      }
      used.add(edge);
      const walk: EdgeWalk = { vertices: [edge.from, edge.to], edges: [edge] };
      extendWalk(walk, edgesAt, used);
      const closed = walk.vertices.length > 2 && walk.vertices[0] === walk.vertices.at(-1);
      if (closed) {
        walk.vertices.pop();
      }
      else {
        walk.vertices.reverse();
        walk.edges.reverse();
        extendWalk(walk, edgesAt, used);
      }
      chains.push({
        points: walk.vertices.map((vertex) => this.#vertices[vertex]),
        outwards: walk.edges.map(({ outward }) => outward),
        closed
      });
    }

    return chains;
  }

  #awayFrom(
    from: number,
    to: number,
    normal: THREE.Vector3,
    opposite: THREE.Vector3
  ): THREE.Vector3 {
    const start = this.#vertices[from];
    const along = new THREE.Vector3().subVectors(this.#vertices[to], start);
    const away = new THREE.Vector3().crossVectors(along, normal).normalize();

    return away.dot(new THREE.Vector3().subVectors(opposite, start)) > 0 ? away.negate() : away;
  }
}

function extendWalk(
  walk: EdgeWalk,
  edgesAt: ReadonlyMap<number, ContourEdge[]>,
  used: Set<ContourEdge>
): void {
  for (;;) {
    const vertex = walk.vertices[walk.vertices.length - 1];
    const around = edgesAt.get(vertex) ?? [];
    const last = walk.edges[walk.edges.length - 1];
    const next = around.length === 2 ? around.find((edge) => edge !== last) : undefined;
    if (next === undefined || used.has(next)) {
      return;
    }
    used.add(next);
    walk.edges.push(next);
    walk.vertices.push(next.from === vertex ? next.to : next.from);
  }
}
