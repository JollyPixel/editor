// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { BrushAimResolver } from "../../../../src/features/painting/interaction/BrushAimResolver.ts";
import type { BrushPlane } from "../../../../src/features/painting/model/brushFootprint.ts";

// CONSTANTS
const kPointer = new THREE.Vector2(0, 0);

interface CellLike {
  x: number;
  y: number;
  z: number;
}

function createRamp(
  cell: CellLike
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      0, 0, 0, 0, 1, 1, 1, 1, 1,
      0, 0, 0, 1, 1, 1, 1, 0, 0
    ], 3)
  );

  const mesh = new THREE.Mesh(geometry);
  mesh.position.set(cell.x, cell.y, cell.z);

  return mesh;
}

function createResolver(
  blocks: CellLike[],
  place: (camera: THREE.PerspectiveCamera) => void,
  ramps: CellLike[] = []
): BrushAimResolver {
  const solid = new THREE.Group();
  for (const block of blocks) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
    solid.add(mesh);
  }
  for (const ramp of ramps) {
    solid.add(createRamp(ramp));
  }
  solid.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  place(camera);
  camera.updateMatrixWorld(true);

  return new BrushAimResolver({
    camera,
    solid,
    groundPlaneSize: 64,
    maxDistance: 32
  });
}

function aimingDownAtFace(
  camera: THREE.PerspectiveCamera
): void {
  camera.position.set(0.5, 2.2, -3);
  camera.lookAt(0.5, 0.85, 0);
}

function heightOf(
  value: number
): BrushPlane {
  return {
    axis: "y",
    value
  };
}

describe("BrushAimResolver.aimAtPlane", () => {
  test("falls back to the height row when nothing is in the way", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 10, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(
      resolver.aimAtPlane(kPointer, heightOf(3), "place"),
      {
        cell: { x: 0, y: 3, z: 0 },
        cursor: { x: 0, y: 3, z: 0 }
      }
    );
  });

  test("uses the height row when the surface stands beyond it", () => {
    const resolver = createResolver([{ x: 0, y: 0, z: 0 }], (camera) => {
      camera.position.set(0.5, 10, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(
      resolver.aimAtPlane(kPointer, heightOf(4), "place"),
      {
        cell: { x: 0, y: 4, z: 0 },
        cursor: { x: 0, y: 4, z: 0 }
      }
    );
  });

  test("places against a surface the height row hides behind", () => {
    const resolver = createResolver(
      [{ x: 0, y: 0, z: 0 }],
      aimingDownAtFace
    );

    assert.deepStrictEqual(
      resolver.aimAtPlane(kPointer, heightOf(0), "place"),
      {
        cell: { x: 0, y: 0, z: -1 },
        cursor: { x: 0, y: 0, z: 0 }
      }
    );
  });

  test("removes the surface the height row hides behind", () => {
    const resolver = createResolver(
      [{ x: 0, y: 0, z: 0 }],
      aimingDownAtFace
    );

    assert.deepStrictEqual(
      resolver.aimAtPlane(kPointer, heightOf(0), "remove"),
      {
        cell: { x: 0, y: 0, z: 0 },
        cursor: { x: 0, y: 0, z: 0 }
      }
    );
  });

  test("reads the cursor off the height row, not off the surface", () => {
    const resolver = createResolver(
      [{ x: 0, y: 0, z: 0 }],
      aimingDownAtFace
    );
    const bare = createResolver([], aimingDownAtFace);

    assert.deepStrictEqual(
      resolver.aimAtPlane(kPointer, heightOf(0), "place")?.cursor,
      bare.aimAtPlane(kPointer, heightOf(0), "place")?.cursor
    );
  });

  test("reports nothing beyond the brush reach", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 100, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.strictEqual(resolver.aimAtPlane(kPointer, heightOf(0), "place"), null);
  });

  test("reports nothing when the ray never meets the height row", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 10, 0.5);
      camera.lookAt(20, 10, 0.5);
    });

    assert.strictEqual(resolver.aimAtPlane(kPointer, heightOf(0), "place"), null);
  });

  test("locks a vertical plane and keeps its value on the locked axis", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 1.5, 8);
      camera.lookAt(0.5, 1.5, 0);
    });

    assert.deepStrictEqual(
      resolver.aimAtPlane(kPointer, { axis: "z", value: 2 }, "place"),
      {
        cell: { x: 0, y: 1, z: 2 },
        cursor: { x: 0, y: 1, z: 2 }
      }
    );
  });

  test("reports nothing when the ray runs parallel to a vertical plane", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 1.5, 8);
      camera.lookAt(0.5, 1.5, 0);
    });

    assert.strictEqual(
      resolver.aimAtPlane(kPointer, { axis: "x", value: 3 }, "place"),
      null
    );
  });
});

describe("BrushAimResolver.resolve", () => {
  test("places against the box face the ray enters", () => {
    const resolver = createResolver([{ x: 0, y: 0, z: 0 }], (camera) => {
      camera.position.set(0.5, 0.5, -4);
      camera.lookAt(0.5, 0.5, 0);
    });

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 0, z: -1 },
      remove: { x: 0, y: 0, z: 0 }
    });
  });

  test("places in front of a ramp slope instead of above it", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 0.5, -3);
      camera.lookAt(0.5, 0.15, 0.15);
    }, [{ x: 0, y: 0, z: 0 }]);

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 0, z: -1 },
      remove: { x: 0, y: 0, z: 0 }
    });
  });

  test("places above a ramp slope aimed at from overhead", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 4, 0.2);
      camera.lookAt(0.5, 0.55, 0.55);
    }, [{ x: 0, y: 0, z: 0 }]);

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 1, z: 0 },
      remove: { x: 0, y: 0, z: 0 }
    });
  });

  test("places on the ground where the ray lands", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(2.5, 5, 2.5);
      camera.lookAt(2.5, 0, 2.5);
    });

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 2, y: 0, z: 2 },
      remove: { x: 2, y: 0, z: 2 }
    });
  });
});

describe("BrushAimResolver sky shell", () => {
  function createSkyResolver(
    skyRadius: number,
    place: (camera: THREE.PerspectiveCamera) => void
  ): BrushAimResolver {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    place(camera);
    camera.updateMatrixWorld(true);

    return new BrushAimResolver({
      camera,
      solid: new THREE.Group(),
      groundPlaneSize: 64,
      maxDistance: 32,
      skyRadius
    });
  }

  function lookUp(
    camera: THREE.PerspectiveCamera
  ): void {
    camera.position.set(0.5, 4.5, 0.5);
    camera.lookAt(0.5, 20, 0.5);
  }

  test("catches a ray the ground plane never meets", () => {
    const resolver = createSkyResolver(10, lookUp);

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 14, z: 0 },
      remove: { x: 0, y: 14, z: 0 }
    });
  });

  test("leaves the sky alone while the shell is disabled", () => {
    const resolver = createSkyResolver(0, lookUp);

    assert.strictEqual(resolver.resolve(kPointer), null);
  });

  test("keeps the ground for a ray that reaches it", () => {
    const resolver = createSkyResolver(10, (camera) => {
      camera.position.set(0.5, 4, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 0, z: 0 },
      remove: { x: 0, y: 0, z: 0 }
    });
  });

  test("catches a ground hit that lies out of reach", () => {
    const resolver = createSkyResolver(10, (camera) => {
      camera.position.set(0.5, 40.5, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 30, z: 0 },
      remove: { x: 0, y: 30, z: 0 }
    });
  });

  test("never reaches further than the brush", () => {
    const resolver = createSkyResolver(50, lookUp);

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 36, z: 0 },
      remove: { x: 0, y: 36, z: 0 }
    });
  });
});
