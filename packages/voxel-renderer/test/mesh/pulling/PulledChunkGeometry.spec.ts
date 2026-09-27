// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  PulledChunkGeometry,
  PulledChunkMesh,
  type ChunkGeometryKey
} from "../../../src/mesh/index.ts";
import {
  buildGeometries,
  makeMeshFixture,
  place,
  type MeshFixture,
  type MeshFixtureOptions
} from "../../helpers/meshFixture.ts";
import {
  RAMP_ID,
  STAIR_ID
} from "../../helpers/ids.ts";

// CONSTANTS
const kEpsilon = 1e-6;

function buildMixedWorld(
  options: MeshFixtureOptions
): MeshFixture {
  const fixture = makeMeshFixture({ chunkSize: 8, ...options });
  place(fixture, [1, 0, 1]);
  place(fixture, [2, 0, 1], RAMP_ID);
  place(fixture, [3, 0, 1], RAMP_ID, 1);
  place(fixture, [1, 0, 2], STAIR_ID, 2);
  place(fixture, [2, 0, 2], STAIR_ID, 5);
  place(fixture, [2, 1, 2]);
  place(fixture, [5, 3, 6], RAMP_ID, 3);
  place(fixture, [6, 3, 6]);
  place(fixture, [7, 7, 7], STAIR_ID, 7);

  return fixture;
}

function pulledGeometries(
  fixture: MeshFixture
): Map<ChunkGeometryKey, PulledChunkGeometry> {
  const result = new Map<ChunkGeometryKey, PulledChunkGeometry>();
  for (const [key, geometry] of buildGeometries(fixture)) {
    assert.ok(geometry instanceof PulledChunkGeometry);
    result.set(key, geometry);
  }

  return result;
}

function assertSameVertices(
  classic: THREE.BufferGeometry,
  pulled: PulledChunkGeometry
): void {
  const expanded = pulled.toIndexedGeometry();
  const expected = classic.getAttribute("position").array;
  const actual = expanded.getAttribute("position").array;
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) < kEpsilon,
      `vertex component ${i}: expected ${expected[i]}, received ${actual[i]}`
    );
  }

  const { start, count } = classic.drawRange;
  assert.deepEqual(
    Array.from(expanded.getIndex()!.array),
    Array.from(classic.getIndex()!.array.subarray(start, start + count))
  );
}

describe("PulledChunkGeometry - classic parity", () => {
  for (const ambientOcclusion of [false, true]) {
    it(`expands to the classic vertices and indices (ambientOcclusion=${ambientOcclusion})`, () => {
      const classic = buildGeometries(buildMixedWorld({ ambientOcclusion }));
      const pulled = pulledGeometries(
        buildMixedWorld({ ambientOcclusion, vertexPulling: true })
      );

      assert.deepEqual(
        [...pulled.keys()].map(String),
        [...classic.keys()].map(String)
      );
      for (const [key, geometry] of classic) {
        const pulledGeometry = [...pulled].find(([other]) => String(other) === String(key))![1];
        assertSameVertices(geometry, pulledGeometry);
      }
    });
  }

  it("draws one instance of an indexed four-corner quad per face", () => {
    const classic = buildGeometries(buildMixedWorld({}));
    const pulled = pulledGeometries(buildMixedWorld({ vertexPulling: true }));

    for (const [key, geometry] of classic) {
      const pulledGeometry = [...pulled].find(([other]) => String(other) === String(key))![1];
      assert.equal(pulledGeometry.instanceCount, geometry.getAttribute("position").count / 4);
      assert.equal(pulledGeometry.faceCount, pulledGeometry.instanceCount);
      const corners = pulledGeometry.getAttribute("position");
      assert.equal(corners.count, 4);
      assert.deepEqual(
        Array.from(pulledGeometry.getIndex()!.array, (index) => corners.getX(index)),
        [0, 1, 2, 0, 2, 3]
      );
    }
  });

  it("reports the classic triangle count and two bytes per vertex", () => {
    const classic = buildMixedWorld({});
    const pulled = buildMixedWorld({ vertexPulling: true });
    buildGeometries(classic);
    buildGeometries(pulled);

    assert.ok(pulled.builder.stats.triangles < pulled.builder.stats.faces * 2);
    assert.equal(pulled.builder.stats.triangles, classic.builder.stats.triangles);
    assert.equal(pulled.builder.stats.vertices, classic.builder.stats.vertices);
    assert.equal(classic.builder.stats.bytesPerVertex, 28);
    assert.equal(pulled.builder.stats.bytesPerVertex, 2);
  });

  it("counts eight bytes per face plus each chunk's indexed quad", () => {
    const pulled = buildMixedWorld({ vertexPulling: true });
    buildGeometries(pulled);
    const { faces, geometries, bytes } = pulled.builder.stats;

    assert.equal(bytes, (faces * 8) + (geometries * ((4 * 3 * 4 * 2) + (6 * 2))));
  });

  it("keeps building classic geometry while greedy meshing is on", () => {
    const fixture = buildMixedWorld({ vertexPulling: true, greedy: true });

    for (const geometry of buildGeometries(fixture).values()) {
      assert.equal(geometry instanceof PulledChunkGeometry, false);
    }
  });
});

describe("PulledChunkGeometry - layout", () => {
  it("packs faces into an RG32UI texture at most 2048 texels wide", () => {
    const fixture = makeMeshFixture({ chunkSize: 32, vertexPulling: true });
    for (let x = 0; x < 32; x += 2) {
      for (let y = 0; y < 6; y += 2) {
        for (let z = 0; z < 32; z += 2) {
          place(fixture, [x, y, z]);
        }
      }
    }
    const [geometry] = pulledGeometries(fixture).values();

    assert.equal(geometry.faceCount, 16 * 3 * 16 * 6);
    assert.equal(geometry.faces.image.width, 2048);
    assert.equal(geometry.faces.image.height, 3);
    assert.equal(geometry.faces.format, THREE.RGIntegerFormat);
    assert.equal(geometry.faces.type, THREE.UnsignedIntType);
    assert.equal(geometry.faces.image.data!.length, 2048 * 3 * 2);
  });

  it("sizes the texture to the face count below one row", () => {
    const fixture = makeMeshFixture({ vertexPulling: true });
    place(fixture, [0, 0, 0]);
    const [geometry] = pulledGeometries(fixture).values();

    assert.equal(geometry.faces.image.width, 6);
    assert.equal(geometry.faces.image.height, 1);
  });

  it("bounds the cells its faces occupy", () => {
    const fixture = makeMeshFixture({ chunkSize: 8, vertexPulling: true });
    place(fixture, [1, 2, 3]);
    place(fixture, [4, 5, 6]);
    const [geometry] = pulledGeometries(fixture).values();

    assert.deepEqual(geometry.boundingBox!.min.toArray(), [1, 2, 3]);
    assert.deepEqual(geometry.boundingBox!.max.toArray(), [5, 6, 7]);
    assert.deepEqual(geometry.boundingSphere!.center.toArray(), [3, 4, 5]);
  });

  it("disposes its face texture with the geometry", () => {
    const fixture = makeMeshFixture({ vertexPulling: true });
    place(fixture, [0, 0, 0]);
    const [geometry] = pulledGeometries(fixture).values();
    let disposed = false;
    geometry.faces.addEventListener("dispose", () => {
      disposed = true;
    });

    geometry.dispose();

    assert.equal(disposed, true);
  });

  it("rejects a word array that does not fill the texture", () => {
    const fixture = makeMeshFixture({ vertexPulling: true });

    assert.throws(() => new PulledChunkGeometry({
      words: new Uint32Array(3),
      faceCount: 2,
      templates: fixture.builder.faceTemplates,
      bounds: new THREE.Box3()
    }), RangeError);
  });
});

describe("PulledChunkMesh - raycast", () => {
  function meshes(
    options: MeshFixtureOptions
  ): THREE.Mesh[] {
    const fixture = buildMixedWorld(options);

    return [...buildGeometries(fixture)].map(([, geometry]) => {
      const material = new THREE.MeshBasicMaterial();
      const mesh = geometry instanceof PulledChunkGeometry ?
        new PulledChunkMesh(geometry, material) :
        new THREE.Mesh(geometry, material);
      mesh.position.set(10, -2, 4);
      mesh.updateMatrixWorld(true);

      return mesh;
    });
  }

  function hits(
    targets: THREE.Mesh[],
    ray: THREE.Ray
  ): THREE.Intersection[] {
    return new THREE.Raycaster(ray.origin, ray.direction)
      .intersectObjects(targets, false);
  }

  const rays = [
    new THREE.Ray(new THREE.Vector3(11.5, 10, 5.5), new THREE.Vector3(0, -1, 0)),
    new THREE.Ray(new THREE.Vector3(12.25, 10, 5.5), new THREE.Vector3(0, -1, 0)),
    new THREE.Ray(new THREE.Vector3(0, -1.5, 5.25), new THREE.Vector3(1, 0, 0)),
    new THREE.Ray(new THREE.Vector3(15.5, 10, 10.5), new THREE.Vector3(0.1, -1, 0.05).normalize())
  ];

  for (const [index, ray] of rays.entries()) {
    it(`hits what the classic mesh hits (ray ${index})`, () => {
      const expected = hits(meshes({}), ray);
      const actual = hits(meshes({ vertexPulling: true }), ray);

      assert.ok(expected.length > 0);
      assert.equal(actual.length, expected.length);
      for (const [hitIndex, hit] of expected.entries()) {
        assert.ok(Math.abs(actual[hitIndex].distance - hit.distance) < kEpsilon);
        assert.ok(actual[hitIndex].point.distanceTo(hit.point) < kEpsilon);
        assert.ok(actual[hitIndex].normal!.distanceTo(hit.normal!) < kEpsilon);
        assert.equal(actual[hitIndex].faceIndex, hit.faceIndex);
        assert.equal(actual[hitIndex].face!.a, hit.face!.a);
      }
    });
  }

  it("misses outside the bounding volume", () => {
    const ray = new THREE.Ray(new THREE.Vector3(-50, 50, -50), new THREE.Vector3(0, 1, 0));

    assert.equal(hits(meshes({ vertexPulling: true }), ray).length, 0);
  });
});
