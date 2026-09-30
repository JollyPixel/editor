// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { HighlightBoxSilhouette } from "#src/index.ts";
import {
  createDefaultHighlightOverlayRegistry
} from "#src/mesh-highlight/overlays/builtinHighlightOverlayFactories.ts";
import { watchDisposal } from "../../fixtures/disposal.ts";
import { createBoxMesh } from "../helpers.ts";
import {
  backPassOf,
  colorAt,
  lastColorOf
} from "./helpers.ts";

describe("constructor", () => {
  test("adds itself as a child of the target", () => {
    const target = createBoxMesh();
    const overlay = new HighlightBoxSilhouette({ target });

    assert.strictEqual(target.children.length, 1);
    assert.strictEqual(target.children[0], overlay);
  });

  test("defaults to white, full opacity", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh() });

    assert.strictEqual(`#${overlay.color.getHexString()}`, "#ffffff");
    assert.strictEqual(overlay.material.opacity, 1);
  });

  test("colors the inner border and the outer ring differently", () => {
    const overlay = new HighlightBoxSilhouette({
      target: createBoxMesh(), color: "#ff0000", innerColor: "#00ff00"
    });

    const first = colorAt(overlay.geometry, 0);
    const last = lastColorOf(overlay.geometry);
    assert.strictEqual(`#${first.getHexString()}`, "#00ff00");
    assert.strictEqual(`#${last.getHexString()}`, "#ff0000");
  });

  test("skips the inner color entirely when innerThickness is 0", () => {
    const overlay = new HighlightBoxSilhouette({
      target: createBoxMesh(), color: "#ff0000", innerColor: "#00ff00", innerThickness: 0
    });

    const count = overlay.geometry.getAttribute("position").count;
    for (let index = 0; index < count; index++) {
      assert.strictEqual(`#${colorAt(overlay.geometry, index).getHexString()}`, "#ff0000");
    }
  });

  test("defaults thickness to 0.05 world units, pushed out past the default inner border", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh() });

    overlay.geometry.computeBoundingBox();
    const box = overlay.geometry.boundingBox as THREE.Box3;
    assert.ok(Math.abs((box.max.x - box.min.x) - 1.14) < 1e-6);
  });

  test("defaults to depth-tested with a low render order", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh() });

    assert.strictEqual(overlay.material.depthTest, true);
    assert.strictEqual(overlay.material.depthWrite, true);
    assert.strictEqual(overlay.renderOrder, 1);
  });

  test("xray keeps the front pass depth-tested and drops depth write", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: true });

    assert.strictEqual(overlay.material.depthTest, true);
    assert.strictEqual(overlay.material.depthWrite, false);
    assert.strictEqual(overlay.renderOrder, 999);
  });

  test("xray adds a single dimmed pass for the occluded portion", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: true, opacity: 0.8 });

    assert.strictEqual(overlay.children.length, 1);
    const back = backPassOf(overlay);
    assert.ok(back);
    assert.strictEqual(back.material.depthTest, true);
    assert.strictEqual(back.material.opacity, 0.8);
  });

  test("dims the occluded portion further when occludedOpacity is set", () => {
    const overlay = new HighlightBoxSilhouette({
      target: createBoxMesh(), xray: true, opacity: 0.8, occludedOpacity: 0.2
    });

    assert.strictEqual(backPassOf(overlay)?.material.opacity, 0.2);
  });

  test("skips the dimmed pass entirely when xray is off", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: false });

    assert.strictEqual(overlay.material.depthTest, true);
    assert.strictEqual(overlay.material.depthWrite, true);
    assert.strictEqual(overlay.children.length, 0);
  });

  test("renders a peer indicator below a local one at the same xray tier", () => {
    const local = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: true });
    const peer = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: true, peer: true });

    assert.ok(peer.renderOrder < local.renderOrder);
  });

  test("renders a peer indicator below a local one off xray too", () => {
    const local = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: false });
    const peer = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: false, peer: true });

    assert.ok(peer.renderOrder < local.renderOrder);
  });

  test("honors an explicit render order over the xray default", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: true, renderOrder: 500 });

    assert.strictEqual(overlay.renderOrder, 500);
  });
});

describe("color", () => {
  test("updates only the outer ring's vertex colors, leaving the inner border untouched", () => {
    const overlay = new HighlightBoxSilhouette({
      target: createBoxMesh(), color: "#000000", innerColor: "#00ff00"
    });

    overlay.color = "#0000ff";

    const first = colorAt(overlay.geometry, 0);
    const last = lastColorOf(overlay.geometry);
    assert.strictEqual(`#${first.getHexString()}`, "#00ff00");
    assert.strictEqual(`#${last.getHexString()}`, "#0000ff");
  });

  test("flags the color attribute for upload", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh() });
    const attribute = overlay.geometry.getAttribute("color") as THREE.BufferAttribute;
    const version = attribute.version;

    overlay.color = "#123456";

    assert.ok(attribute.version > version);
  });
});

describe("opacity", () => {
  test("updates the shared material opacity without ever leaving the transparent pass", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh() });

    overlay.opacity = 0.5;
    assert.strictEqual(overlay.material.opacity, 0.5);
    assert.strictEqual(overlay.material.transparent, true);

    overlay.opacity = 1;
    assert.strictEqual(overlay.material.opacity, 1);
    assert.strictEqual(overlay.material.transparent, true);
  });
});

describe("xray", () => {
  test("toggling xray on drops depth write, keeps depth test, and leaves render order untouched", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh() });
    const before = overlay.renderOrder;
    overlay.xray = true;

    assert.strictEqual(overlay.material.depthTest, true);
    assert.strictEqual(overlay.material.depthWrite, false);
    assert.strictEqual(overlay.renderOrder, before);
  });

  test("xrayDepthWrite keeps depth write on under xray, even after toggling", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: true, xrayDepthWrite: true });

    assert.strictEqual(overlay.material.depthWrite, true);
    assert.strictEqual(backPassOf(overlay)?.material.depthWrite, false);

    overlay.xray = false;
    overlay.xray = true;

    assert.strictEqual(overlay.material.depthWrite, true);
  });

  test("toggling xray back off removes the occluded pass", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: true });

    overlay.xray = false;

    assert.strictEqual(overlay.material.depthWrite, true);
    assert.strictEqual(overlay.children.length, 0);
  });
});

describe("dispose", () => {
  test("removes itself from the target and disposes geometry/material", () => {
    const target = createBoxMesh();
    const overlay = new HighlightBoxSilhouette({ target });
    const counts = watchDisposal(overlay.geometry, overlay.material);

    overlay.dispose();

    assert.strictEqual(target.children.length, 0);
    assert.deepStrictEqual(counts, [1, 1]);
  });

  test("also disposes the occluded pass's own material", () => {
    const overlay = new HighlightBoxSilhouette({ target: createBoxMesh(), xray: true });
    const counts = watchDisposal(backPassOf(overlay)?.material);

    overlay.dispose();

    assert.deepStrictEqual(counts, [1]);
  });
});

describe("boxSilhouette factory", () => {
  test("draws a peer indicator one step below the requested render order", () => {
    const registry = createDefaultHighlightOverlayRegistry();
    const [local, peer] = [false, true].map((isPeer) => registry.create(createBoxMesh(), {
      technique: "boxSilhouette",
      color: "#ffffff",
      opacity: 1,
      xray: true,
      peer: isPeer,
      renderOrder: 42
    }) as HighlightBoxSilhouette);

    assert.strictEqual(local.renderOrder, 42);
    assert.strictEqual(peer.renderOrder, 41);
  });
});
