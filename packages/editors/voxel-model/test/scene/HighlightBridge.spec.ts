// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { HighlightBoxSilhouette } from "@jolly-pixel/three";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { HighlightBridge } from "#src/scene/HighlightBridge.ts";
import type { ModelBlock } from "#src/scene/blocks/index.ts";
import { PresenceStore } from "#src/state/index.ts";
import { createModelFixture } from "../fixtures/model.ts";

function stubCamera(): OrbitFlyCamera {
  return {
    threeCamera: new THREE.PerspectiveCamera(),
    depth: 0
  } as unknown as OrbitFlyCamera;
}

function stubRenderer(): THREE.WebGPURenderer {
  return { render: () => void 0 } as unknown as THREE.WebGPURenderer;
}

function pivotMarkerOf(
  block: ModelBlock
): THREE.Sprite | undefined {
  return block.pivot.children.find(
    (child): child is THREE.Sprite => child.name === "pivot_visual"
  );
}

function overlayOf(
  block: ModelBlock
): HighlightBoxSilhouette | undefined {
  return block.mesh.children.find(
    (child): child is HighlightBoxSilhouette => child instanceof HighlightBoxSilhouette
  );
}

function createHarness() {
  const { scene, blocks, addBlock } = createModelFixture();
  const presence = new PresenceStore();
  const highlight = new HighlightBridge({
    renderer: stubRenderer(),
    scene,
    camera: stubCamera(),
    blocks,
    presence
  });

  return { blocks, addBlock, presence, highlight };
}

function peerMarks(
  uuid: string,
  clientId = "bob",
  color = "#ff0000"
): Map<string, { clientId: string; displayName: string; color: string; }[]> {
  return new Map([
    [uuid, [{ clientId, displayName: "Bob", color }]]
  ]);
}

describe("HighlightBridge local selection", () => {
  test("shows the selection ghost and a box outline on the selected block", () => {
    const { blocks, addBlock } = createHarness();
    const block = addBlock();

    blocks.select(block);

    assert.ok(block.mesh.children.some((child) => child.name === "selection-texture-ghost"));
    assert.ok(overlayOf(block));
  });

  test("hides the ghost again once a different block is selected", () => {
    const { blocks, addBlock } = createHarness();
    const first = addBlock();
    const second = addBlock();

    blocks.select(first);
    blocks.select(second);

    assert.ok(!first.mesh.children.some((child) => child.name === "selection-texture-ghost"));
  });
});

describe("HighlightBridge local hover", () => {
  test("shows a box outline on the hovered block", () => {
    const { blocks, addBlock } = createHarness();
    const block = addBlock();

    blocks.hover(block);

    assert.ok(overlayOf(block));
  });
});

describe("HighlightBridge peer selection", () => {
  test("shows a box outline for the peer's selected block without touching the local pivot marker", () => {
    const { addBlock, presence } = createHarness();
    const block = addBlock();

    presence.blockSelections = peerMarks(block.uuid);

    assert.ok(overlayOf(block));
    assert.equal(pivotMarkerOf(block)?.visible, false);
  });

  test("clears the outline once the peer's mark drops out", () => {
    const { addBlock, presence } = createHarness();
    const block = addBlock();
    presence.blockSelections = peerMarks(block.uuid);

    presence.blockSelections = new Map();

    assert.equal(overlayOf(block), undefined);
  });

  test("moves the outline when the peer selects a different block", () => {
    const { addBlock, presence } = createHarness();
    const first = addBlock();
    const second = addBlock();
    presence.blockSelections = peerMarks(first.uuid);

    presence.blockSelections = peerMarks(second.uuid);

    assert.equal(overlayOf(first), undefined);
    assert.ok(overlayOf(second));
  });
});

describe("HighlightBridge peer hover", () => {
  test("shows a box outline for the peer's hovered block", () => {
    const { addBlock, presence } = createHarness();
    const block = addBlock();

    presence.blockHovers = peerMarks(block.uuid);

    assert.ok(overlayOf(block));
  });

  test("clears the outline once the peer stops hovering", () => {
    const { addBlock, presence } = createHarness();
    const block = addBlock();
    presence.blockHovers = peerMarks(block.uuid);

    presence.blockHovers = new Map();

    assert.equal(overlayOf(block), undefined);
  });
});

describe("HighlightBridge block lifecycle", () => {
  test("registers blocks that already existed before construction", () => {
    const { scene, blocks, addBlock } = createModelFixture();
    const block = addBlock();
    const presence = new PresenceStore();

    new HighlightBridge({
      renderer: stubRenderer(),
      scene,
      camera: stubCamera(),
      blocks,
      presence
    });
    blocks.select(block);

    assert.ok(overlayOf(block));
  });

  test("registers blocks added after construction", () => {
    const { blocks, addBlock } = createHarness();

    const block = addBlock();
    blocks.select(block);

    assert.ok(overlayOf(block));
  });
});

describe("HighlightBridge dispose", () => {
  test("stops forwarding further block and presence changes", () => {
    const { blocks, addBlock, presence, highlight } = createHarness();
    const block = addBlock();

    highlight.dispose();

    assert.doesNotThrow(() => blocks.select(block));
    assert.doesNotThrow(() => blocks.hover(block));
    assert.doesNotThrow(() => {
      presence.blockSelections = peerMarks(block.uuid);
    });
    assert.doesNotThrow(() => {
      presence.blockHovers = peerMarks(block.uuid);
    });
  });
});
