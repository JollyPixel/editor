// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  MeshHighlight,
  HighlightOutline,
  HighlightBoundingBox,
  type MeshHighlightOptions
} from "#src/index.ts";
import {
  createBoxMesh,
  createRendererStub
} from "./helpers.ts";

function createOutlineScene(
  options: Partial<MeshHighlightOptions> = {}
) {
  const highlight = new MeshHighlight({
    renderer: createRendererStub(),
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    visibility: false,
    ...options
  });
  const mesh = createBoxMesh();
  const group = new THREE.Group();
  group.add(createBoxMesh());
  highlight.register("mesh", mesh);
  highlight.register("group", group);

  return { highlight, mesh, group };
}

function findOutline(
  mesh: THREE.Mesh
): HighlightOutline {
  const [overlay] = mesh.children;
  assert.ok(overlay instanceof HighlightOutline);

  return overlay;
}

describe("default outline renderer", () => {
  test("outlines a selected mesh and boxes a selected group", () => {
    const { highlight, mesh, group } = createOutlineScene();

    highlight.select("mesh");
    highlight.hover("group");

    assert.strictEqual(findOutline(mesh).opacity, highlight.appearance.selected.opacity);
    assert.ok(group.children.at(-1) instanceof HighlightBoundingBox);
  });

  test("gives a hover hidden under the selection back once the selection moves", () => {
    const { highlight, mesh } = createOutlineScene();
    highlight.hover("mesh");
    highlight.select("mesh");

    highlight.select("group");

    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(findOutline(mesh).opacity, highlight.appearance.hovered.opacity);
  });

  test("updates the active overlay in place when configured", () => {
    const { highlight, mesh } = createOutlineScene();
    highlight.select("mesh");
    const before = findOutline(mesh);

    highlight.configure({
      selected: {
        color: "#ff0000"
      },
      outline: {
        linewidth: 5
      },
      xray: true
    });

    const after = findOutline(mesh);
    assert.strictEqual(after, before);
    assert.strictEqual(`#${after.color.getHexString()}`, "#ff0000");
    assert.strictEqual(after.material.linewidth, 5);
    assert.strictEqual(after.material.depthTest, false);
  });

  test("draws a peer's selection in the peer's color and drops it on release", () => {
    const { highlight, mesh } = createOutlineScene();

    highlight.peers.select("peer-a", "mesh");
    const color = new THREE.Color(highlight.peers.peerColor("peer-a"));
    assert.strictEqual(findOutline(mesh).color.getHex(), color.getHex());

    highlight.peers.removePeer("peer-a");
    assert.strictEqual(mesh.children.length, 0);
  });

  test("resolves a technique added to its overlay registry", () => {
    const { highlight } = createOutlineScene();
    const disposed: string[] = [];
    highlight.overlayRegistry.register({
      id: "custom",
      supports: () => true,
      create: () => {
        return {
          color: "#ffffff",
          opacity: 1,
          xray: false,
          dispose: () => disposed.push("custom")
        };
      }
    });
    highlight.register("custom", createBoxMesh(), { technique: "custom" });

    highlight.select("custom");
    highlight.select(null);

    assert.deepStrictEqual(disposed, ["custom"]);
  });
});
