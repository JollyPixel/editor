// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CUBE_ID as kCubeId } from "../helpers/engine.ts";
import {
  chunkMeshes,
  debugGroup,
  findDebugGroup,
  makeDebugEngine,
  overlayMeshes,
  wireframeMaterial
} from "./VoxelDebugger.helpers.ts";

describe("VoxelDebugger - wireframe", () => {
  it("is off by default and leaves nothing in the scene graph", () => {
    const engine = makeDebugEngine();

    assert.equal(engine.debug.mode, "off");
    assert.equal(engine.debug.enabled, false);
    assert.equal(findDebugGroup(engine), undefined);
  });

  it("adds one wireframe per chunk mesh, sharing its geometry", () => {
    const engine = makeDebugEngine();
    engine.debug.mode = "overlay";

    const [mesh] = chunkMeshes(engine);
    const overlays = overlayMeshes(engine);

    assert.equal(overlays.length, 1);
    assert.equal(mesh.visible, true);
    assert.equal(overlays[0].geometry, mesh.geometry);
    assert.ok(wireframeMaterial(overlays[0]).wireframe);
  });

  it("hides textured meshes in wireframe mode and restores them", () => {
    const engine = makeDebugEngine();

    engine.debug.mode = "wireframe";
    assert.equal(chunkMeshes(engine)[0].visible, false);
    assert.equal(debugGroup(engine).children.length, 1);

    engine.debug.mode = "off";
    assert.equal(chunkMeshes(engine)[0].visible, true);
    assert.equal(findDebugGroup(engine), undefined);
  });

  it("applies the mode to chunks meshed after it was set", () => {
    const engine = makeDebugEngine();
    engine.debug.mode = "wireframe";

    engine.world.setVoxel("Ground", {
      position: { x: 0, y: 8, z: 0 },
      blockId: kCubeId
    });
    engine.tick(0);

    assert.equal(debugGroup(engine).children.length, 2);
    for (const mesh of chunkMeshes(engine)) {
      assert.equal(mesh.visible, false);
    }
  });

  it("removes the wireframe of a chunk that is rebuilt", () => {
    const engine = makeDebugEngine();
    engine.debug.mode = "overlay";

    engine.markAllChunksDirty("test");
    engine.tick(0);

    const overlays = overlayMeshes(engine);
    assert.equal(overlays.length, 1);
    assert.equal(
      overlays[0].geometry,
      chunkMeshes(engine)[0].geometry
    );
  });

  it("starts in the mode passed through the engine options", () => {
    const engine = makeDebugEngine({
      debug: {
        mode: "overlay",
        color: 0xFF0000,
        opacity: 1
      }
    });

    assert.equal(engine.debug.enabled, true);
    const material = wireframeMaterial(overlayMeshes(engine)[0]);
    assert.equal(material.transparent, false);
    assert.equal(material.color.getHex(), 0xFF0000);
  });

  it("cycles off to overlay to wireframe to off", () => {
    const engine = makeDebugEngine();
    const { debug } = engine;

    assert.equal(debug.nextMode(), "overlay");
    assert.equal(debug.nextMode(), "wireframe");
    assert.equal(debug.nextMode(), "off");

    debug.enabled = true;
    assert.equal(debug.mode, "overlay");
    debug.enabled = false;
    assert.equal(debug.mode, "off");
  });

  it("detaches the wireframe group on dispose", () => {
    const engine = makeDebugEngine({
      debug: { mode: "overlay" }
    });
    engine.dispose();

    assert.equal(findDebugGroup(engine), undefined);
    assert.equal(engine.debug.stats.chunks, 0);
  });
});
