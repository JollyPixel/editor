// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  PulledChunkGeometry,
  PulledChunkMesh
} from "../../../../src/view/meshing/index.ts";
import {
  buildGeometries,
  makeMeshFixture,
  place,
  type MeshFixture,
  type MeshFixtureOptions
} from "../../../helpers/meshFixture.ts";
import {
  RAMP_ID,
  STAIR_ID
} from "../../../helpers/ids.ts";
import { expandPulled } from "../../../helpers/pulledFaces.ts";

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

function assertSameExpansion(
  geometry: PulledChunkGeometry
): void {
  const expected = expandPulled(geometry);
  const actual = geometry.toIndexedGeometry();
  const expectedPositions = expected.getAttribute("position").array;
  const actualPositions = actual.getAttribute("position").array;
  assert.equal(actualPositions.length, expectedPositions.length);
  for (let i = 0; i < expectedPositions.length; i++) {
    assert.ok(
      Math.abs(actualPositions[i] - expectedPositions[i]) < kEpsilon,
      `vertex component ${i}: expected ${expectedPositions[i]}, received ${actualPositions[i]}`
    );
  }
  assert.deepEqual(
    Array.from(actual.getIndex()!.array),
    Array.from(expected.getIndex()!.array)
  );
}

describe("PulledChunkGeometry - faces", () => {
  for (const ambientOcclusion of [false, true]) {
    it(`expands to the vertices its face records describe (ambientOcclusion=${ambientOcclusion})`, () => {
      const geometries = buildGeometries(buildMixedWorld({ ambientOcclusion }));

      for (const geometry of geometries.values()) {
        assertSameExpansion(geometry);
      }
    });
  }

  it("draws one instance of an indexed four-corner quad per face", () => {
    const fixture = buildMixedWorld({});
    let faces = 0;

    for (const geometry of buildGeometries(fixture).values()) {
      assert.equal(geometry.faceCount, geometry.instanceCount);
      faces += geometry.faceCount;
      const corners = geometry.getAttribute("position");
      assert.equal(corners.count, 4);
      assert.deepEqual(
        Array.from(geometry.getIndex()!.array, (index) => corners.getX(index)),
        [0, 1, 2, 0, 2, 3]
      );
    }
    assert.equal(faces, fixture.builder.stats.faces);
  });
});

describe("PulledChunkGeometry - layout", () => {
  it("packs faces into an RG32UI texture at most 2048 texels wide", () => {
    const fixture = makeMeshFixture({ chunkSize: 32 });
    for (let x = 0; x < 32; x += 2) {
      for (let y = 0; y < 6; y += 2) {
        for (let z = 0; z < 32; z += 2) {
          place(fixture, [x, y, z]);
        }
      }
    }
    const [geometry] = buildGeometries(fixture).values();

    assert.equal(geometry.faceCount, 16 * 3 * 16 * 6);
    assert.equal(geometry.faces.image.width, 2048);
    assert.equal(geometry.faces.image.height, 3);
    assert.equal(geometry.faces.format, THREE.RGIntegerFormat);
    assert.equal(geometry.faces.type, THREE.UnsignedIntType);
    assert.equal(geometry.faces.image.data!.length, 2048 * 3 * 2);
  });

  it("sizes the texture to the face count below one row", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);
    const [geometry] = buildGeometries(fixture).values();

    assert.equal(geometry.faces.image.width, 6);
    assert.equal(geometry.faces.image.height, 1);
  });

  it("bounds the cells its faces occupy", () => {
    const fixture = makeMeshFixture({ chunkSize: 8 });
    place(fixture, [1, 2, 3]);
    place(fixture, [4, 5, 6]);
    const [geometry] = buildGeometries(fixture).values();

    assert.deepEqual(geometry.boundingBox!.min.toArray(), [1, 2, 3]);
    assert.deepEqual(geometry.boundingBox!.max.toArray(), [5, 6, 7]);
    assert.deepEqual(geometry.boundingSphere!.center.toArray(), [3, 4, 5]);
  });

  it("disposes its face texture with the geometry", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);
    const [geometry] = buildGeometries(fixture).values();
    let disposed = false;
    geometry.faces.addEventListener("dispose", () => {
      disposed = true;
    });

    geometry.dispose();

    assert.equal(disposed, true);
  });

  it("rejects a word array that does not fill the texture", () => {
    const fixture = makeMeshFixture();

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
    expanded: boolean
  ): THREE.Mesh[] {
    const fixture = buildMixedWorld({});

    return [...buildGeometries(fixture).values()].map((geometry) => {
      const material = new THREE.MeshBasicMaterial();
      const mesh = expanded ?
        new THREE.Mesh(expandPulled(geometry), material) :
        new PulledChunkMesh(geometry, material);
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
    it(`hits what the expanded mesh hits (ray ${index})`, () => {
      const expected = hits(meshes(true), ray);
      const actual = hits(meshes(false), ray);

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

    assert.equal(hits(meshes(false), ray).length, 0);
  });
});
