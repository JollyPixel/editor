// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { VoxelEngine } from "../../src/VoxelEngine.ts";
import { VoxelInspector } from "../../src/inspector/index.ts";
import { MeshBuildStats } from "../../src/mesh/index.ts";
import { BlockRegistry } from "../../src/blocks/index.ts";
import { VoxelWorld } from "../../src/world/index.ts";
import {
  makeEngine,
  fillChunks,
  placeCube
} from "../helpers/engine.ts";
import { CHUNK_SIZE as kChunkSize } from "../helpers/ids.ts";
import {
  findGroup,
  inspectorGroup,
  makeInspectorEngine
} from "./VoxelInspector.helpers.ts";

// CONSTANTS
const kBoundsGroup = "VoxelInspector:chunkBounds";

function boundsBoxes(
  engine: VoxelEngine
): THREE.LineSegments[] {
  return inspectorGroup(engine, kBoundsGroup).children.filter(
    (child): child is THREE.LineSegments => child instanceof THREE.LineSegments
  );
}

function makeBoundsEngine(
  chunks = 1
): VoxelEngine {
  const engine = makeInspectorEngine({ inspector: { chunkBounds: true } });
  fillChunks(engine, "Ground", chunks);
  engine.tick(0);

  return engine;
}

describe("VoxelInspector - chunk bounds", () => {
  it("is off by default and toggles its boxes independently of the mode", () => {
    const engine = makeInspectorEngine();
    assert.equal(engine.inspector.chunkBounds, false);
    assert.equal(findGroup(engine, kBoundsGroup), undefined);

    engine.inspector.chunkBounds = true;
    assert.equal(engine.inspector.mode, "off");
    assert.equal(boundsBoxes(engine).length, 1);
    assert.equal(findGroup(engine), undefined);

    engine.inspector.chunkBounds = false;
    assert.equal(findGroup(engine, kBoundsGroup), undefined);

    engine.inspector.chunkBounds = true;
    assert.equal(boundsBoxes(engine).length, 1);
  });

  it("places one box per chunk on its origin, sharing geometry and material", () => {
    const boxes = boundsBoxes(makeBoundsEngine(3));

    assert.deepEqual(
      boxes.map((box) => box.position.x).sort((a, b) => a - b),
      [0, kChunkSize, kChunkSize * 2]
    );
    for (const box of boxes) {
      assert.equal(box.position.y, 0);
      assert.equal(box.position.z, 0);
      assert.deepEqual(box.scale.toArray(), [kChunkSize, kChunkSize, kChunkSize]);
      assert.equal(box.geometry, boxes[0].geometry);
      assert.equal(box.material, boxes[0].material);
    }
  });

  it("shifts the box by the layer position", () => {
    const engine = makeEngine({ inspector: { chunkBounds: true } });
    engine.world.addLayer("Shifted").position = { x: 10, y: 20, z: 30 };
    placeCube(engine, "Shifted", { x: 10, y: 20, z: 30 });
    engine.tick(0);

    const [box] = boundsBoxes(engine);
    assert.deepEqual(box.position.toArray(), [10, 20, 30]);
  });

  it("copies bounds passed to registerChunk", () => {
    const parent = new THREE.Group();
    const inspector = new VoxelInspector(
      {
        parent,
        world: new VoxelWorld(kChunkSize),
        blockRegistry: new BlockRegistry()
      },
      { chunkBounds: true }
    );
    const origin = { x: 1, y: 2, z: 3 };

    inspector.registerChunk("chunk", [], new MeshBuildStats(), { origin, size: 4 });
    origin.x = 99;
    inspector.chunkBounds = false;
    inspector.chunkBounds = true;

    const group = parent.getObjectByName(kBoundsGroup);
    assert.ok(group);
    const [box] = group.children;
    assert.ok(box instanceof THREE.LineSegments);
    assert.deepEqual(box.position.toArray(), [1, 2, 3]);
    assert.equal(box.scale.x, 4);
  });

  it("outlines a chunk that produced no geometry", () => {
    const engine = new VoxelEngine({
      chunkSize: kChunkSize,
      layers: ["Ground"],
      inspector: { chunkBounds: true }
    });
    fillChunks(engine, "Ground", 1);
    engine.tick(0);

    assert.equal(engine.inspector.mesh.stats.chunks, 1);
    assert.equal(engine.inspector.mesh.stats.meshes, 0);
    assert.equal(boundsBoxes(engine).length, 1);
  });

  it("drops the box of a chunk whose layer is removed", () => {
    const engine = makeBoundsEngine();

    engine.world.removeLayer("Ground");
    engine.tick(0);

    assert.equal(boundsBoxes(engine).length, 0);
  });

  it("detaches the bounds group on dispose", () => {
    const engine = makeBoundsEngine();

    engine.dispose();

    assert.equal(findGroup(engine, kBoundsGroup), undefined);
  });
});
