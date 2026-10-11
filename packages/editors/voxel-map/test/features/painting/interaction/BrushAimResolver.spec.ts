// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import { floorVoxelPosition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BrushAimResolver,
  type BrushAim
} from "../../../../src/features/painting/interaction/BrushAimResolver.ts";
import { CellFace } from "../../../../src/features/painting/model/CellFace.ts";

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

function probedAim(
  resolver: BrushAimResolver
): BrushAim {
  const aim = resolver.resolve(kPointer);
  assert.ok(aim !== null && aim.probe !== null);

  return {
    ...aim,
    probe: floorVoxelPosition(aim.probe)
  };
}

describe("BrushAimResolver.aimAtHeight", () => {
  test("reads the cell the ray crosses on the height row", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 10, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(
      resolver.aimAtHeight(kPointer, 3),
      { x: 0, y: 3, z: 0 }
    );
  });

  test("reads the height row whatever surface stands in the way", () => {
    const covered = createResolver(
      [{ x: 0, y: 0, z: 0 }],
      aimingDownAtFace
    );
    const bare = createResolver([], aimingDownAtFace);

    for (const resolver of [covered, bare]) {
      assert.deepStrictEqual(
        resolver.aimAtHeight(kPointer, 0),
        { x: 0, y: 0, z: 0 }
      );
    }
  });

  test("reports nothing beyond the brush reach", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 100, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.strictEqual(resolver.aimAtHeight(kPointer, 0), null);
  });

  test("reports nothing when the ray never meets the height row", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 10, 0.5);
      camera.lookAt(20, 10, 0.5);
    });

    assert.strictEqual(resolver.aimAtHeight(kPointer, 0), null);
  });
});

describe("BrushAimResolver.resolve", () => {
  test("places against the box face the ray enters", () => {
    const resolver = createResolver([{ x: 0, y: 0, z: 0 }], (camera) => {
      camera.position.set(0.5, 0.5, -4);
      camera.lookAt(0.5, 0.5, 0);
    });

    assert.deepStrictEqual(probedAim(resolver), {
      place: { x: 0, y: 0, z: -1 },
      remove: { x: 0, y: 0, z: 0 },
      face: CellFace.NegZ,
      probe: { x: 0, y: 0, z: 0 }
    });
  });

  test("places in front of a ramp slope instead of above it", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 0.5, -3);
      camera.lookAt(0.5, 0.15, 0.15);
    }, [{ x: 0, y: 0, z: 0 }]);

    assert.deepStrictEqual(probedAim(resolver), {
      place: { x: 0, y: 0, z: -1 },
      remove: { x: 0, y: 0, z: 0 },
      face: CellFace.NegZ,
      probe: { x: 0, y: 0, z: 0 }
    });
  });

  test("places above a ramp slope aimed at from overhead", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 4, 0.2);
      camera.lookAt(0.5, 0.55, 0.55);
    }, [{ x: 0, y: 0, z: 0 }]);

    assert.deepStrictEqual(probedAim(resolver), {
      place: { x: 0, y: 1, z: 0 },
      remove: { x: 0, y: 0, z: 0 },
      face: CellFace.PosY,
      probe: { x: 0, y: 0, z: 0 }
    });
  });

  test("places on the ground where the ray lands", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(2.5, 5, 2.5);
      camera.lookAt(2.5, 0, 2.5);
    });

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 2, y: 0, z: 2 },
      remove: { x: 2, y: 0, z: 2 },
      face: CellFace.NegY,
      probe: null
    });
  });
});

describe("BrushAimResolver aim cache", () => {
  function aimingDown(
    camera: THREE.PerspectiveCamera
  ): void {
    camera.position.set(0.5, 10, 0.5);
    camera.lookAt(0.5, 0, 0.5);
  }

  function digTopBlock(
    solid: THREE.Object3D
  ): void {
    const top = solid.children.find((child) => child.position.y === 1.5);
    assert.ok(top !== undefined);
    solid.remove(top);
  }

  function createStack(): {
    resolver: BrushAimResolver;
    solid: THREE.Group;
  } {
    const solid = new THREE.Group();
    for (const y of [0, 1]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      mesh.position.set(0.5, y + 0.5, 0.5);
      solid.add(mesh);
    }
    solid.updateMatrixWorld(true);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    aimingDown(camera);
    camera.updateMatrixWorld(true);

    return {
      solid,
      resolver: new BrushAimResolver({
        camera,
        solid,
        groundPlaneSize: 64,
        maxDistance: 32
      })
    };
  }

  test("holds its aim while the pointer and the camera stay still", () => {
    const { resolver, solid } = createStack();

    const held = resolver.resolve(kPointer);
    digTopBlock(solid);

    assert.strictEqual(resolver.resolve(kPointer), held);
  });

  test("aims again once invalidated", () => {
    const { resolver, solid } = createStack();

    resolver.resolve(kPointer);
    digTopBlock(solid);
    resolver.invalidate();

    assert.deepStrictEqual(
      resolver.resolve(kPointer)?.remove,
      { x: 0, y: 0, z: 0 }
    );
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
      remove: { x: 0, y: 14, z: 0 },
      face: null,
      probe: null
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
      remove: { x: 0, y: 0, z: 0 },
      face: CellFace.NegY,
      probe: null
    });
  });

  test("catches a ground hit that lies out of reach", () => {
    const resolver = createSkyResolver(10, (camera) => {
      camera.position.set(0.5, 40.5, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 30, z: 0 },
      remove: { x: 0, y: 30, z: 0 },
      face: null,
      probe: null
    });
  });

  test("never reaches further than the brush", () => {
    const resolver = createSkyResolver(50, lookUp);

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 36, z: 0 },
      remove: { x: 0, y: 36, z: 0 },
      face: null,
      probe: null
    });
  });
});
