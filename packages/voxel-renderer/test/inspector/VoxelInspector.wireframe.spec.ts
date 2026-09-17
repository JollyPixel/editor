// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CUBE_ID as kCubeId } from "../helpers/engine.ts";
import {
  chunkMeshes,
  inspectorGroup,
  findInspectorGroup,
  makeInspectorEngine,
  overlayMeshes,
  wireframeMaterial
} from "./VoxelInspector.helpers.ts";

describe("VoxelInspector - wireframe", () => {
  it("is off by default and leaves nothing in the scene graph", () => {
    const engine = makeInspectorEngine();

    assert.equal(engine.inspector.mode, "off");
    assert.equal(engine.inspector.enabled, false);
    assert.equal(findInspectorGroup(engine), undefined);
  });

  it("adds one wireframe per chunk mesh, sharing its geometry", () => {
    const engine = makeInspectorEngine();
    engine.inspector.mode = "overlay";

    const [mesh] = chunkMeshes(engine);
    const overlays = overlayMeshes(engine);

    assert.equal(overlays.length, 1);
    assert.equal(mesh.visible, true);
    assert.equal(overlays[0].geometry, mesh.geometry);
    assert.ok(wireframeMaterial(overlays[0]).wireframe);
  });

  it("hides textured meshes in wireframe mode and restores them", () => {
    const engine = makeInspectorEngine();

    engine.inspector.mode = "wireframe";
    assert.equal(chunkMeshes(engine)[0].visible, false);
    assert.equal(inspectorGroup(engine).children.length, 1);

    engine.inspector.mode = "off";
    assert.equal(chunkMeshes(engine)[0].visible, true);
    assert.equal(findInspectorGroup(engine), undefined);
  });

  it("applies the mode to chunks meshed after it was set", () => {
    const engine = makeInspectorEngine();
    engine.inspector.mode = "wireframe";

    engine.world.setVoxel("Ground", {
      position: { x: 0, y: 8, z: 0 },
      blockId: kCubeId
    });
    engine.tick(0);

    assert.equal(inspectorGroup(engine).children.length, 2);
    for (const mesh of chunkMeshes(engine)) {
      assert.equal(mesh.visible, false);
    }
  });

  it("removes the wireframe of a chunk that is rebuilt", () => {
    const engine = makeInspectorEngine();
    engine.inspector.mode = "overlay";

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
    const engine = makeInspectorEngine({
      inspector: {
        mode: "overlay",
        color: 0xFF0000,
        opacity: 1
      }
    });

    assert.equal(engine.inspector.enabled, true);
    const material = wireframeMaterial(overlayMeshes(engine)[0]);
    assert.equal(material.transparent, false);
    assert.equal(material.color.getHex(), 0xFF0000);
  });

  it("cycles off to overlay to wireframe to off", () => {
    const engine = makeInspectorEngine();
    const { inspector } = engine;

    assert.equal(inspector.nextMode(), "overlay");
    assert.equal(inspector.nextMode(), "wireframe");
    assert.equal(inspector.nextMode(), "off");

    inspector.enabled = true;
    assert.equal(inspector.mode, "overlay");
    inspector.enabled = false;
    assert.equal(inspector.mode, "off");
  });

  it("detaches the wireframe group on dispose", () => {
    const engine = makeInspectorEngine({
      inspector: { mode: "overlay" }
    });
    engine.dispose();

    assert.equal(findInspectorGroup(engine), undefined);
    assert.equal(engine.inspector.mesh.stats.chunks, 0);
  });
});
