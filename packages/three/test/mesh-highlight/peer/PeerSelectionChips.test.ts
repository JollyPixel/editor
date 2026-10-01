// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  MeshHighlightState,
  PeerSelectionRegistry,
  PeerSelectionChips,
  PeerSelectionVisibility
} from "#src/index.ts";
import { PeerSelectionChip } from "#src/mesh-highlight/peer/PeerSelectionChip.ts";
import { watchDisposal } from "../../fixtures/disposal.ts";
import {
  createBox,
  createFrontCamera,
  createPeerScene
} from "./helpers.ts";

function createHarness(
  options?: { visibility?: boolean; enabled?: boolean; }
): {
  selection: MeshHighlightState;
  registry: PeerSelectionRegistry;
  chips: PeerSelectionChips;
  visibility: PeerSelectionVisibility | undefined;
  mesh: THREE.Mesh;
} {
  const { selection, registry, mesh } = createPeerScene();

  const visibility = options?.visibility ?
    new PeerSelectionVisibility({
      registry,
      selection,
      camera: createFrontCamera()
    }) :
    undefined;

  const chips = new PeerSelectionChips({
    registry,
    selection,
    visibility,
    enabled: options?.enabled ?? true
  });

  return {
    selection,
    registry,
    chips,
    visibility,
    mesh
  };
}

function chipsOf(
  mesh: THREE.Mesh
): PeerSelectionChip[] {
  return (mesh.children[0] as THREE.Group).children as PeerSelectionChip[];
}

describe("peer selection", () => {
  test("a single selector produces no chip row", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");

    assert.strictEqual(mesh.children.length, 0);
  });

  test("two selectors produce one group with one chip per selector, oldest first", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    const chips = chipsOf(mesh);
    assert.strictEqual(chips.length, 2);
    assert.strictEqual(chips[0].color, registry.colorOf("peer-a"));
    assert.strictEqual(chips[1].color, registry.colorOf("peer-b"));
  });

  test("a third selector rebuilds the group with three chips", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    registry.select("peer-c", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    const chips = chipsOf(mesh);
    assert.strictEqual(chips.length, 3);
    assert.strictEqual(chips[2].color, registry.colorOf("peer-c"));
  });

  test("dropping back to a single selector removes the chip row", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    registry.select("peer-b", null);

    assert.strictEqual(mesh.children.length, 0);
  });
});

describe("overflow cap", () => {
  test("four selectors show three chips plus one overflow badge labeled \"+1\"", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    registry.select("peer-c", "mesh-1");
    registry.select("peer-d", "mesh-1");

    const chips = chipsOf(mesh);
    assert.strictEqual(chips.length, 4, "3 capped chips + 1 overflow badge");
    assert.strictEqual(chips[0].color, registry.colorOf("peer-a"));
    assert.strictEqual(chips[1].color, registry.colorOf("peer-b"));
    assert.strictEqual(chips[2].color, registry.colorOf("peer-c"));
    const badge = chips[3];
    assert.strictEqual(badge.label, "+1");
    assert.notStrictEqual(
      badge.color,
      registry.colorOf("peer-d"),
      "the overflow badge is never colored like a real peer"
    );
  });

  test("six selectors still show only three chips plus one overflow badge labeled \"+3\"", () => {
    const { registry, mesh } = createHarness();
    for (const peerId of ["peer-a", "peer-b", "peer-c", "peer-d", "peer-e", "peer-f"]) {
      registry.select(peerId, "mesh-1");
    }

    const chips = chipsOf(mesh);
    assert.strictEqual(chips.length, 4);
    assert.strictEqual(chips[3].label, "+3");
  });

  test(
    "the overflow badge relabels in place when the overflow count changes but the slot count doesn't",
    () => {
      const { selection, registry, visibility, mesh } = createHarness({ visibility: true });
      mesh.position.set(0, 0, -10);
      for (const peerId of ["peer-a", "peer-b", "peer-c", "peer-d"]) {
        registry.select(peerId, "mesh-1");
      }
      visibility!.update();
      const badgeBefore = chipsOf(mesh)[3];
      assert.strictEqual(badgeBefore.label, "+1");

      registry.select("peer-e", "mesh-1");
      const otherMesh = createBox();
      selection.register("mesh-2", otherMesh);
      otherMesh.position.set(0, 0, 10);
      registry.select("peer-f", "mesh-2");
      visibility!.update();

      const chipsAfter = chipsOf(mesh);
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
    const { registry, visibility, mesh } = createHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    visibility!.update();

    assert.strictEqual(mesh.children.length, 0);
  });

  test("shows the chip row once visibility reports it visible again", () => {
    const { registry, visibility, mesh } = createHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    visibility!.update();
    assert.strictEqual(mesh.children.length, 0);

    mesh.position.set(0, 0, -10);
    visibility!.update();

    assert.strictEqual(mesh.children.length, 1);
  });
});

describe("enabled", () => {
  test("defaults to false and suppresses chip rows even for a qualifying multi-selector", () => {
    const { selection, registry, mesh } = createPeerScene();
    const chips = new PeerSelectionChips({ registry, selection });
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    assert.strictEqual(chips.enabled, false);
    assert.strictEqual(mesh.children.length, 0);
  });

  test("enabling immediately builds rows for every qualifying object", () => {
    const { registry, chips, mesh } = createHarness({ enabled: false });
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    assert.strictEqual(mesh.children.length, 0);

    chips.enabled = true;

    assert.strictEqual(chips.enabled, true);
    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(chipsOf(mesh).length, 2);
  });

  test("disabling immediately disposes every active chip row", () => {
    const { registry, chips, mesh } = createHarness({ enabled: true });
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    assert.strictEqual(mesh.children.length, 1);

    chips.enabled = false;

    assert.strictEqual(chips.enabled, false);
    assert.strictEqual(mesh.children.length, 0);
  });
});

describe("dispose", () => {
  test("removes all chip rows, releases their textures and detaches listeners", () => {
    const { registry, chips, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    const counts = watchDisposal(
      ...chipsOf(mesh).map((chip) => chip.material.map ?? undefined)
    );

    chips.dispose();

    assert.strictEqual(mesh.children.length, 0);
    assert.deepStrictEqual(counts, [1, 1]);

    registry.select("peer-c", "mesh-1");
    assert.strictEqual(mesh.children.length, 0, "must stop reacting to registry changes after dispose");
  });
});
