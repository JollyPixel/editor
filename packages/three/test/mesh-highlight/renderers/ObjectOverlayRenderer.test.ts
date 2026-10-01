// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  ObjectOverlayRenderer,
  MeshHighlightAppearance
} from "#src/index.ts";
import {
  CAMERA,
  createObjectOverlayRenderer,
  createRegistry,
  indicator,
  type TestOverlay
} from "./helpers.ts";

describe("ObjectOverlayRenderer", () => {
  test("updates a compatible overlay in place", () => {
    const overlays: TestOverlay[] = [];
    const renderer = createObjectOverlayRenderer(overlays);
    const target = new THREE.Mesh();
    const appearance = new MeshHighlightAppearance();
    renderer.sync([indicator(target)], appearance);

    renderer.sync([
      indicator(target, {
        color: "#ff0000",
        opacity: 0.5
      })
    ], appearance.with({
      outline: {
        linewidth: 4
      },
      xray: true
    }));

    assert.strictEqual(overlays.length, 1);
    assert.strictEqual(overlays[0].color, "#ff0000");
    assert.strictEqual(overlays[0].opacity, 0.5);
    assert.strictEqual(overlays[0].linewidth, 4);
    assert.strictEqual(overlays[0].xray, true);
  });

  test("replaces incompatible overlays and disposes removed ones", () => {
    const overlays: TestOverlay[] = [];
    const renderer = createObjectOverlayRenderer(overlays);
    const target = new THREE.Mesh();
    const appearance = new MeshHighlightAppearance();
    renderer.sync([indicator(target)], appearance);

    renderer.sync([
      indicator(target, {
        technique: "custom"
      })
    ], appearance);
    renderer.sync([], appearance);

    assert.strictEqual(overlays.length, 2);
    assert.strictEqual(overlays[0].disposeCount, 1);
    assert.strictEqual(overlays[1].disposeCount, 1);
  });

  test("marks a peer indicator's overlay as belonging to a peer", () => {
    const overlays: TestOverlay[] = [];
    const renderer = createObjectOverlayRenderer(overlays);
    const target = new THREE.Mesh();

    renderer.sync(
      [indicator(target, { source: "peer" })],
      new MeshHighlightAppearance()
    );

    assert.strictEqual(overlays[0].peer, true);
  });

  test("replaces the overlay when an indicator's source changes, technique staying the same", () => {
    const overlays: TestOverlay[] = [];
    const renderer = createObjectOverlayRenderer(overlays);
    const target = new THREE.Mesh();
    const appearance = new MeshHighlightAppearance();
    renderer.sync([indicator(target, { source: "peer" })], appearance);

    renderer.sync([indicator(target, { source: "local" })], appearance);

    assert.strictEqual(overlays.length, 2);
    assert.strictEqual(overlays[0].disposeCount, 1);
    assert.strictEqual(overlays[1].peer, false);
  });

  test("dims any indicator's occluded opacity by the configured scale, local and peer alike", () => {
    const overlays: TestOverlay[] = [];
    const renderer = createObjectOverlayRenderer(overlays);
    const peerTarget = new THREE.Mesh();
    const localTarget = new THREE.Mesh();
    const appearance = new MeshHighlightAppearance({ occludedOpacityScale: 0.25 });

    renderer.sync([
      { ...indicator(peerTarget, { source: "peer", opacity: 0.8 }), objectId: "peer" },
      { ...indicator(localTarget, { source: "local", opacity: 0.8 }), objectId: "local" }
    ], appearance);

    const [peerOverlay, localOverlay] = overlays;
    assert.strictEqual(peerOverlay.occludedOpacity, 0.2);
    assert.strictEqual(localOverlay.occludedOpacity, 0.2);
  });

  test("forwards the appearance render order and xray depth write to the factory", () => {
    const overlays: TestOverlay[] = [];
    const renderer = createObjectOverlayRenderer(overlays);

    renderer.sync(
      [indicator(new THREE.Mesh())],
      new MeshHighlightAppearance({ renderOrder: 42, xrayDepthWrite: true })
    );

    assert.strictEqual(overlays[0].createOptions.renderOrder, 42);
    assert.strictEqual(overlays[0].createOptions.xrayDepthWrite, true);
  });

  test("places the overlays before drawing the scene, or only places them without renderScene", () => {
    const calls: string[] = [];
    const overlays: TestOverlay[] = [];
    const drawing = new ObjectOverlayRenderer({
      registry: createRegistry(overlays),
      renderScene: () => calls.push("draw"),
      camera: CAMERA
    });
    const placing = new ObjectOverlayRenderer({
      registry: createRegistry(overlays),
      camera: CAMERA
    });
    const appearance = new MeshHighlightAppearance();
    drawing.sync([indicator(new THREE.Mesh())], appearance);
    placing.sync([indicator(new THREE.Mesh())], appearance);
    for (const overlay of overlays) {
      overlay.calls = calls;
    }

    drawing.render();
    placing.render();

    assert.deepStrictEqual(calls, ["update", "draw", "update"]);
  });

  test("leaves the occluded opacity at the visible one when no scale is configured", () => {
    const overlays: TestOverlay[] = [];
    const renderer = createObjectOverlayRenderer(overlays);
    const target = new THREE.Mesh();

    renderer.sync([indicator(target, { opacity: 0.8 })], new MeshHighlightAppearance());

    assert.strictEqual(overlays[0].occludedOpacity, 0.8);
  });
});
