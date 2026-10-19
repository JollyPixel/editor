// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { MeshHighlight } from "#src/index.ts";
import { PeerSelectionChip } from "#src/mesh-highlight/peer/PeerSelectionChip.ts";
import { watchDisposal } from "../../fixtures/disposal.ts";
import { createHarness as createHighlightHarness } from "../helpers.ts";
import {
  createBox,
  createFrontCamera
} from "./helpers.ts";

function createHarness(
  options?: { visibility?: boolean; enabled?: boolean; }
): {
  highlight: MeshHighlight;
  mesh: THREE.Mesh;
} {
  const { highlight } = createHighlightHarness({
    camera: createFrontCamera(),
    visibility: options?.visibility ? {} : false,
    chips: options?.enabled ?? true
  });
  const mesh = createBox();
  highlight.register("mesh-1", mesh);

  return {
    highlight,
    mesh
  };
}

function findChips(
  mesh: THREE.Mesh
): PeerSelectionChip[] {
  return (mesh.children[0] as THREE.Group).children as PeerSelectionChip[];
}

describe("peer selection", () => {
  test("a single selector produces no chip row", () => {
    const { highlight: { peers }, mesh } = createHarness();
    peers.select("peer-a", "mesh-1");

    assert.strictEqual(mesh.children.length, 0);
  });

  test("two selectors produce one group with one chip per selector, oldest first", () => {
    const { highlight: { peers }, mesh } = createHarness();
    peers.select("peer-a", "mesh-1");
    peers.select("peer-b", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    const chips = findChips(mesh);
    assert.strictEqual(chips.length, 2);
    assert.strictEqual(chips[0].color, peers.peerColor("peer-a"));
    assert.strictEqual(chips[1].color, peers.peerColor("peer-b"));
  });

  test("a third selector rebuilds the group with three chips", () => {
    const { highlight: { peers }, mesh } = createHarness();
    peers.select("peer-a", "mesh-1");
    peers.select("peer-b", "mesh-1");
    peers.select("peer-c", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    const chips = findChips(mesh);
    assert.strictEqual(chips.length, 3);
    assert.strictEqual(chips[2].color, peers.peerColor("peer-c"));
  });

  test("dropping back to a single selector removes the chip row", () => {
    const { highlight: { peers }, mesh } = createHarness();
    peers.select("peer-a", "mesh-1");
    peers.select("peer-b", "mesh-1");
    peers.select("peer-b", null);

    assert.strictEqual(mesh.children.length, 0);
  });
});

describe("targets", () => {
  test("re-registering an id moves its chip row to the new object", () => {
    const { highlight, mesh } = createHarness();
    highlight.peers.select("peer-a", "mesh-1");
    highlight.peers.select("peer-b", "mesh-1");
    const replacement = createBox();

    highlight.register("mesh-1", replacement);

    assert.strictEqual(mesh.children.length, 0);
    assert.strictEqual(findChips(replacement).length, 2);
  });

  test("unregistering an id removes its chip row", () => {
    const { highlight, mesh } = createHarness();
    highlight.peers.select("peer-a", "mesh-1");
    highlight.peers.select("peer-b", "mesh-1");

    highlight.unregister("mesh-1");

    assert.strictEqual(mesh.children.length, 0);
  });
});

describe("overflow cap", () => {
  test("four selectors show three chips plus one overflow badge labeled \"+1\"", () => {
    const { highlight: { peers }, mesh } = createHarness();
    peers.select("peer-a", "mesh-1");
    peers.select("peer-b", "mesh-1");
    peers.select("peer-c", "mesh-1");
    peers.select("peer-d", "mesh-1");

    const chips = findChips(mesh);
    assert.strictEqual(chips.length, 4, "3 capped chips + 1 overflow badge");
    assert.strictEqual(chips[0].color, peers.peerColor("peer-a"));
    assert.strictEqual(chips[1].color, peers.peerColor("peer-b"));
    assert.strictEqual(chips[2].color, peers.peerColor("peer-c"));
    const badge = chips[3];
    assert.strictEqual(badge.label, "+1");
    assert.notStrictEqual(
      badge.color,
      peers.peerColor("peer-d"),
      "the overflow badge is never colored like a real peer"
    );
  });

  test("six selectors still show only three chips plus one overflow badge labeled \"+3\"", () => {
    const { highlight: { peers }, mesh } = createHarness();
    for (const peerId of ["peer-a", "peer-b", "peer-c", "peer-d", "peer-e", "peer-f"]) {
      peers.select(peerId, "mesh-1");
    }

    const chips = findChips(mesh);
    assert.strictEqual(chips.length, 4);
    assert.strictEqual(chips[3].label, "+3");
  });

  test(
    "the overflow badge relabels in place when the overflow count changes but the slot count doesn't",
    () => {
      const { highlight, mesh } = createHarness({ visibility: true });
      const { peers } = highlight;
      mesh.position.set(0, 0, -10);
      for (const peerId of ["peer-a", "peer-b", "peer-c", "peer-d"]) {
        peers.select(peerId, "mesh-1");
      }
      highlight.update();
      const badgeBefore = findChips(mesh)[3];
      assert.strictEqual(badgeBefore.label, "+1");

      peers.select("peer-e", "mesh-1");
      const otherMesh = createBox();
      highlight.register("mesh-2", otherMesh);
      otherMesh.position.set(0, 0, 10);
      peers.select("peer-f", "mesh-2");
      highlight.update();

      const chipsAfter = findChips(mesh);
      assert.strictEqual(
        chipsAfter.length,
        4,
        "slot count unchanged (still capped at 3 + 1 overflow)"
      );
      assert.strictEqual(chipsAfter[3], badgeBefore, "must reuse the same badge chip instance");
      assert.strictEqual(chipsAfter[3].label, "+2");
    }
  );
});

describe("visibility", () => {
  test("suppresses the chip row for an object visibility reports not visible", () => {
    const { highlight, mesh } = createHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    highlight.peers.select("peer-a", "mesh-1");
    highlight.peers.select("peer-b", "mesh-1");
    highlight.update();

    assert.strictEqual(mesh.children.length, 0);
  });

  test("shows the chip row once visibility reports it visible again", () => {
    const { highlight, mesh } = createHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    highlight.peers.select("peer-a", "mesh-1");
    highlight.peers.select("peer-b", "mesh-1");
    highlight.update();
    assert.strictEqual(mesh.children.length, 0);

    mesh.position.set(0, 0, -10);
    highlight.update();

    assert.strictEqual(mesh.children.length, 1);
  });
});

describe("enabled", () => {
  test("defaults to false and suppresses chip rows even for a qualifying multi-selector", () => {
    const { highlight } = createHighlightHarness();
    const mesh = createBox();
    highlight.register("mesh-1", mesh);
    highlight.peers.select("peer-a", "mesh-1");
    highlight.peers.select("peer-b", "mesh-1");

    assert.strictEqual(highlight.chips.enabled, false);
    assert.strictEqual(mesh.children.length, 0);
  });

  test("enabling immediately builds rows for every qualifying object", () => {
    const { highlight, mesh } = createHarness({ enabled: false });
    highlight.peers.select("peer-a", "mesh-1");
    highlight.peers.select("peer-b", "mesh-1");
    assert.strictEqual(mesh.children.length, 0);

    highlight.chips.enabled = true;

    assert.strictEqual(highlight.chips.enabled, true);
    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(findChips(mesh).length, 2);
  });

  test("disabling immediately disposes every active chip row", () => {
    const { highlight, mesh } = createHarness({ enabled: true });
    highlight.peers.select("peer-a", "mesh-1");
    highlight.peers.select("peer-b", "mesh-1");
    assert.strictEqual(mesh.children.length, 1);

    highlight.chips.enabled = false;

    assert.strictEqual(highlight.chips.enabled, false);
    assert.strictEqual(mesh.children.length, 0);
  });
});

describe("dispose", () => {
  test("removes all chip rows, releases their textures and stops reacting to peers", () => {
    const { highlight, mesh } = createHarness();
    const { peers } = highlight;
    peers.select("peer-a", "mesh-1");
    peers.select("peer-b", "mesh-1");
    const counts = watchDisposal(
      ...findChips(mesh).map((chip) => chip.material.map ?? undefined)
    );

    highlight.dispose();

    assert.strictEqual(mesh.children.length, 0);
    assert.deepStrictEqual(counts, [1, 1]);

    peers.select("peer-c", "mesh-1");
    peers.select("peer-d", "mesh-1");
    assert.strictEqual(mesh.children.length, 0, "must stop reacting to peer changes after dispose");
  });
});
