// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PulledChunkGeometry } from "../../../src/view/meshing/index.ts";
import {
  chunkGroup,
  chunkMeshes,
  placeCube
} from "../../helpers/view.ts";
import {
  inspectorGroup,
  findGroup,
  makeInspectorView,
  overlayMeshes,
  wireframeMaterial
} from "./VoxelInspector.helpers.ts";

describe("VoxelInspector - wireframe", () => {
  it("is off by default and leaves nothing in the scene graph", () => {
    const view = makeInspectorView();

    assert.equal(view.inspector.mode, "off");
    assert.equal(view.inspector.enabled, false);
    assert.equal(findGroup(view), undefined);
  });

  it("adds one wireframe per chunk mesh, drawing each of its faces", () => {
    const view = makeInspectorView();
    view.inspector.mode = "overlay";

    const [mesh] = chunkMeshes(view);
    const overlays = overlayMeshes(view);
    const { faceCount } = mesh.geometry as PulledChunkGeometry;

    assert.equal(overlays.length, 1);
    assert.equal(mesh.visible, true);
    assert.equal(overlays[0].geometry.getAttribute("position").count, faceCount * 4);
    assert.equal(overlays[0].geometry.getIndex()?.count, faceCount * 6);
    assert.deepEqual(overlays[0].position, mesh.position);
    assert.ok(wireframeMaterial(overlays[0]).wireframe);
  });

  it("hides textured meshes in wireframe mode and restores them", () => {
    const view = makeInspectorView();

    view.inspector.mode = "wireframe";
    assert.equal(chunkGroup(view).visible, false);
    assert.equal(chunkMeshes(view)[0].visible, true);
    assert.equal(inspectorGroup(view).children.length, 1);

    view.inspector.mode = "off";
    assert.equal(chunkGroup(view).visible, true);
    assert.equal(findGroup(view), undefined);
  });

  it("applies the mode to chunks meshed after it was set", () => {
    const view = makeInspectorView();
    view.inspector.mode = "wireframe";

    placeCube(view, "Ground", { x: 0, y: 8, z: 0 });
    view.tick(0);

    assert.equal(inspectorGroup(view).children.length, 2);
    assert.equal(chunkGroup(view).visible, false);
  });

  it("replaces and disposes the wireframe of a chunk that is rebuilt", () => {
    const view = makeInspectorView();
    view.inspector.mode = "overlay";
    const [before] = overlayMeshes(view);
    let disposed = false;
    before.geometry.addEventListener("dispose", () => {
      disposed = true;
    });

    view.markAllChunksDirty("test");
    view.tick(0);

    const overlays = overlayMeshes(view);
    assert.equal(overlays.length, 1);
    assert.notEqual(overlays[0], before);
    assert.equal(overlays[0].name, `${chunkMeshes(view)[0].name}:wireframe`);
    assert.equal(disposed, true);
  });

  it("starts in the mode passed through the view options", () => {
    const view = makeInspectorView({
      inspector: {
        mode: "overlay",
        color: 0xFF0000,
        opacity: 1
      }
    });

    assert.equal(view.inspector.enabled, true);
    const material = wireframeMaterial(overlayMeshes(view)[0]);
    assert.equal(material.transparent, false);
    assert.equal(material.color.getHex(), 0xFF0000);
  });

  it("cycles off to overlay to wireframe to off", () => {
    const view = makeInspectorView();
    const { inspector } = view;

    assert.equal(inspector.nextMode(), "overlay");
    assert.equal(inspector.nextMode(), "wireframe");
    assert.equal(inspector.nextMode(), "off");

    inspector.enabled = true;
    assert.equal(inspector.mode, "overlay");
    inspector.enabled = false;
    assert.equal(inspector.mode, "off");
  });

  it("detaches the wireframe group on dispose", () => {
    const view = makeInspectorView({
      inspector: { mode: "overlay" }
    });
    view.dispose();

    assert.equal(findGroup(view), undefined);
    assert.equal(view.inspector.mesh.stats.chunks, 0);
  });
});
