// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PeerSelectionHighlight } from "#src/collaboration/PeerSelectionHighlight.ts";
import type { ModelBlock } from "#src/scene/blocks/index.ts";
import { PresenceStore } from "#src/state/index.ts";
import { createModelFixture } from "../fixtures/model.ts";

type ShellMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

function mark(
  clientId: string,
  color: string
): PresencePeer {
  return { clientId, displayName: clientId, color };
}

function createHarness() {
  const { blocks, addBlock } = createModelFixture();
  const presence = new PresenceStore();
  const highlight = new PeerSelectionHighlight({ blocks, presence });

  return {
    blocks,
    addBlock,
    presence,
    highlight
  };
}

function glowOf(
  block: ModelBlock
): string | undefined {
  const shell = block.mesh.children.find(
    (child): child is ShellMesh => child.name === "emphasis-shell"
  );

  return shell?.material.color.getHexString();
}

describe("PeerSelectionHighlight", () => {
  test("emphasizes the block a peer has selected", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    harness.presence.blockSelections = new Map([[block.uuid, [mark("bob", "#112233")]]]);

    assert.equal(glowOf(block), "112233");
    harness.highlight.dispose();
  });

  test("clears the glow once the peer deselects", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    harness.presence.blockSelections = new Map([[block.uuid, [mark("bob", "#112233")]]]);
    harness.presence.blockSelections = new Map();

    assert.equal(glowOf(block), undefined);
    harness.highlight.dispose();
  });

  test("moves the glow when the peer selects a different block", () => {
    const harness = createHarness();
    const first = harness.addBlock();
    const second = harness.addBlock();

    harness.presence.blockSelections = new Map([[first.uuid, [mark("bob", "#112233")]]]);
    harness.presence.blockSelections = new Map([[second.uuid, [mark("bob", "#112233")]]]);

    assert.equal(glowOf(first), undefined);
    assert.equal(glowOf(second), "112233");
    harness.highlight.dispose();
  });

  test("keeps the glow lit for the remaining peer when one of two deselects", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    harness.presence.blockSelections = new Map([
      [block.uuid, [mark("bob", "#ff0000"), mark("cleo", "#0000ff")]]
    ]);
    harness.presence.blockSelections = new Map([[block.uuid, [mark("bob", "#ff0000")]]]);

    assert.equal(glowOf(block), "ff0000");
    harness.highlight.dispose();
  });

  test("clears every tracked glow on dispose", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    harness.presence.blockSelections = new Map([[block.uuid, [mark("bob", "#112233")]]]);
    harness.highlight.dispose();

    assert.equal(glowOf(block), undefined);
  });
});
