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

function createScene(
  place: (camera: THREE.PerspectiveCamera) => void
): {
  camera: THREE.PerspectiveCamera;
  resolver: BrushAimResolver;
  addBlock: (cell: CellLike) => void;
} {
  const solid = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  place(camera);
  camera.updateMatrixWorld(true);

  return {
    camera,
    resolver: new BrushAimResolver({
      camera,
      solid,
      groundPlaneSize: 64,
      maxDistance: 32
    }),
    addBlock(cell: CellLike): void {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      mesh.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
      solid.add(mesh);
      solid.updateMatrixWorld(true);
    }
  };
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

describe("BrushAimResolver.aimAtHeight", () => {
  test("falls back to the height row when nothing is in the way", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 10, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(
      resolver.aimAtHeight(kPointer, 3, "place"),
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
      resolver.aimAtHeight(kPointer, 4, "place"),
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
      resolver.aimAtHeight(kPointer, 0, "place"),
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
      resolver.aimAtHeight(kPointer, 0, "remove"),
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
      resolver.aimAtHeight(kPointer, 0, "place")?.cursor,
      bare.aimAtHeight(kPointer, 0, "place")?.cursor
    );
  });

  test("reports nothing beyond the brush reach", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 100, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.strictEqual(resolver.aimAtHeight(kPointer, 0, "place"), null);
  });

  test("reports nothing when the ray never meets the height row", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 10, 0.5);
      camera.lookAt(20, 10, 0.5);
    });

    assert.strictEqual(resolver.aimAtHeight(kPointer, 0, "place"), null);
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

describe("BrushAimResolver aim hold", () => {
  function lookStraightDown(
    camera: THREE.PerspectiveCamera
  ): void {
    camera.position.set(0.5, 10, 0.5);
    camera.lookAt(0.5, 0, 0.5);
  }

  test("holds the aim while the pointer and the camera stay still", () => {
    const scene = createScene(lookStraightDown);
    const before = scene.resolver.resolve(kPointer);

    scene.addBlock({ x: 0, y: 0, z: 0 });

    assert.deepStrictEqual(scene.resolver.resolve(kPointer), before);
    assert.deepStrictEqual(before, {
      place: { x: 0, y: 0, z: 0 },
      remove: { x: 0, y: 0, z: 0 }
    });
  });

  test("aims again once the pointer moves", () => {
    const scene = createScene(lookStraightDown);
    scene.resolver.resolve(kPointer);
    scene.addBlock({ x: 0, y: 0, z: 0 });

    assert.deepStrictEqual(
      scene.resolver.resolve(new THREE.Vector2(0.01, 0)),
      {
        place: { x: 0, y: 1, z: 0 },
        remove: { x: 0, y: 0, z: 0 }
      }
    );
  });

  test("aims again once the camera moves", () => {
    const scene = createScene(lookStraightDown);
    scene.resolver.resolve(kPointer);
    scene.addBlock({ x: 0, y: 0, z: 0 });
    scene.camera.position.setY(9);
    scene.camera.updateMatrixWorld(true);

    assert.deepStrictEqual(scene.resolver.resolve(kPointer), {
      place: { x: 0, y: 1, z: 0 },
      remove: { x: 0, y: 0, z: 0 }
    });
  });

  test("aims again once the reach changed", () => {
    const scene = createScene(lookStraightDown);
    scene.resolver.resolve(kPointer);
    scene.addBlock({ x: 0, y: 0, z: 0 });
    scene.resolver.maxDistance = 20;

    assert.deepStrictEqual(scene.resolver.resolve(kPointer), {
      place: { x: 0, y: 1, z: 0 },
      remove: { x: 0, y: 0, z: 0 }
    });
  });
});
