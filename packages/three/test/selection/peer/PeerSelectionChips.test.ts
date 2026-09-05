// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerSelectionChips,
  PeerSelectionVisibility
} from "#src/index.ts";
import { PeerSelectionChip } from "#src/selection/peer/PeerSelectionChip.ts";

function createHarness(
  options?: { visibility?: boolean; enabled?: boolean; }
): {
  selection: SelectionManager;
  registry: PeerSelectionRegistry;
  chips: PeerSelectionChips;
  visibility: PeerSelectionVisibility | undefined;
  mesh: THREE.Mesh;
} {
  const selection = new SelectionManager();
  const registry = new PeerSelectionRegistry();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  selection.register("mesh-1", mesh);

  let visibility: PeerSelectionVisibility | undefined;
  if (options?.visibility) {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld();
    visibility = new PeerSelectionVisibility({ registry, selection, camera });
  }

  const chips = new PeerSelectionChips({
    registry, selection, visibility, enabled: options?.enabled ?? true
  });

  return {
    selection, registry, chips, visibility, mesh
  };
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
    const group = mesh.children[0] as THREE.Group;
    assert.strictEqual(group.children.length, 2);
    assert.strictEqual((group.children[0] as PeerSelectionChip).color, registry.colorOf("peer-a"));
    assert.strictEqual((group.children[1] as PeerSelectionChip).color, registry.colorOf("peer-b"));
  });

  test("a third selector rebuilds the group with three chips", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    registry.select("peer-c", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    const group = mesh.children[0] as THREE.Group;
    assert.strictEqual(group.children.length, 3);
    assert.strictEqual((group.children[2] as PeerSelectionChip).color, registry.colorOf("peer-c"));
  });

  test("dropping back to a single selector removes the chip row", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    registry.select("peer-b", null);

    assert.strictEqual(mesh.children.length, 0);
  });

  // A same-count "swap" (e.g. peer-a leaves, peer-c joins) is never actually
  // reachable as a single refresh in practice - `PeerSelectionRegistry.select`
  // changes one object's selector count by exactly 1 per call, so the count
  // always passes through a transient 1 (disposing the row) or 3 (rebuilding
  // it) in between. The real trigger for "refresh called again with the
  // selector set unchanged" is a `visibilityChange` sweep touching an
  // unrelated object - `#onVisibilityChange` re-refreshes every currently
  // peer-selected id, this one included, even though nothing about it
  // actually changed.
  test("recolors existing chips in place on a visibilityChange sweep that doesn't touch this object's own selectors", () => {
    const { selection, registry, visibility, mesh } = createHarness({ visibility: true });
    // Visible throughout.
    mesh.position.set(0, 0, -10);
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    visibility!.update();
    const group = mesh.children[0] as THREE.Group;
    const chipBefore = group.children[0];

    const otherMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-2", otherMesh);
    // Starts not visible - a real flip once evaluated.
    otherMesh.position.set(0, 0, 10);
    registry.select("peer-c", "mesh-2");
    visibility!.update();

    assert.strictEqual(mesh.children.length, 1, "must still be exactly one group");
    const groupAfter = mesh.children[0] as THREE.Group;
    assert.strictEqual(groupAfter.children.length, 2);
    assert.strictEqual(groupAfter.children[0], chipBefore, "must reuse the same chip instance, not rebuild it");
  });
});

describe("overflow cap", () => {
  test("four selectors show three chips plus one overflow badge labeled \"+1\"", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    registry.select("peer-c", "mesh-1");
    registry.select("peer-d", "mesh-1");

    const group = mesh.children[0] as THREE.Group;
    assert.strictEqual(group.children.length, 4, "3 capped chips + 1 overflow badge");
    assert.strictEqual((group.children[0] as PeerSelectionChip).color, registry.colorOf("peer-a"));
    assert.strictEqual((group.children[1] as PeerSelectionChip).color, registry.colorOf("peer-b"));
    assert.strictEqual((group.children[2] as PeerSelectionChip).color, registry.colorOf("peer-c"));
    const badge = group.children[3] as PeerSelectionChip;
    assert.strictEqual(badge.label, "+1");
    assert.notStrictEqual(badge.color, registry.colorOf("peer-d"), "the overflow badge is never colored like a real peer");
  });

  test("six selectors still show only three chips plus one overflow badge labeled \"+3\"", () => {
    const { registry, mesh } = createHarness();
    for (const peerId of ["peer-a", "peer-b", "peer-c", "peer-d", "peer-e", "peer-f"]) {
      registry.select(peerId, "mesh-1");
    }

    const group = mesh.children[0] as THREE.Group;
    assert.strictEqual(group.children.length, 4);
    assert.strictEqual((group.children[3] as PeerSelectionChip).label, "+3");
  });

  test("the overflow badge relabels in place when the overflow count changes but the slot count doesn't", () => {
    const { selection, registry, visibility, mesh } = createHarness({ visibility: true });
    // Stays visible throughout - see PeerSelectionChips' own test above for
    // why a visibilityChange sweep is the real trigger for a same-slot-count
    // re-refresh.
    mesh.position.set(0, 0, -10);
    for (const peerId of ["peer-a", "peer-b", "peer-c", "peer-d"]) {
      registry.select(peerId, "mesh-1");
    }
    visibility!.update();
    const group = mesh.children[0] as THREE.Group;
    const badgeBefore = group.children[3];
    assert.strictEqual((badgeBefore as PeerSelectionChip).label, "+1");

    // 5 selectors now - still 3 + 1 overflow slot.
    registry.select("peer-e", "mesh-1");
    const otherMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-2", otherMesh);
    otherMesh.position.set(0, 0, 10);
    registry.select("peer-f", "mesh-2");
    visibility!.update();

    const groupAfter = mesh.children[0] as THREE.Group;
    assert.strictEqual(groupAfter.children.length, 4, "slot count unchanged (still capped at 3 + 1 overflow)");
    assert.strictEqual(groupAfter.children[3], badgeBefore, "must reuse the same badge chip instance");
    assert.strictEqual((groupAfter.children[3] as PeerSelectionChip).label, "+2");
  });
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

  test("omitting visibility preserves always-visible behavior", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
  });
});

describe("enabled", () => {
  test("defaults to false and suppresses chip rows even for a qualifying multi-selector", () => {
    const { registry, chips, mesh } = createHarness({ enabled: false });
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
    const group = mesh.children[0] as THREE.Group;
    assert.strictEqual(group.children.length, 2);
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

  test("assigning the current value is a no-op", () => {
    const { registry, chips, mesh } = createHarness({ enabled: true });
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    const group = mesh.children[0] as THREE.Group;
    const chipBefore = group.children[0];

    chips.enabled = true;

    assert.strictEqual(mesh.children[0], group, "must not rebuild an unrelated group");
    assert.strictEqual((mesh.children[0] as THREE.Group).children[0], chipBefore);
  });
});

describe("dispose", () => {
  test("removes all chip rows and detaches listeners", () => {
    const { registry, chips, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    chips.dispose();

    assert.strictEqual(mesh.children.length, 0);

    registry.select("peer-c", "mesh-1");
    assert.strictEqual(mesh.children.length, 0, "must stop reacting to registry changes after dispose");
  });
});
