// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerColoredOutline,
  type ColoredOutlineEntry
} from "#src/index.ts";

/**
 * A spy standing in for a real `ColoredOutlinePass` - `PeerColoredOutline`
 * only ever calls `setEntries` on it, so a real instance (which needs a
 * `THREE.WebGPURenderer`) isn't needed to test the wiring logic here.
 */
function createColoredOutlineSpy(): {
  setEntries: (entries: ColoredOutlineEntry[]) => void;
  calls: ColoredOutlineEntry[][];
} {
  const calls: ColoredOutlineEntry[][] = [];

  return {
    setEntries: (entries) => {
      calls.push(entries);
    },
    calls
  };
}

function createHarness(): {
  selection: SelectionManager;
  registry: PeerSelectionRegistry;
  coloredOutline: ReturnType<typeof createColoredOutlineSpy>;
  peerColoredOutline: PeerColoredOutline;
  mesh: THREE.Mesh;
} {
  const selection = new SelectionManager();
  const registry = new PeerSelectionRegistry();
  const coloredOutline = createColoredOutlineSpy();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

  selection.register("mesh-1", mesh);

  const peerColoredOutline = new PeerColoredOutline({
    registry,
    selection,
    coloredOutline
  });

  return {
    selection, registry, coloredOutline, peerColoredOutline, mesh
  };
}

function lastEntries(
  spy: ReturnType<typeof createColoredOutlineSpy>
): ColoredOutlineEntry[] {
  return spy.calls.at(-1) ?? [];
}

describe("peer selection", () => {
  test("one peer selecting a registered mesh produces exactly one entry in its color", () => {
    const { registry, coloredOutline, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-a"));
    assert.ok(!entries[0].priority, "a peer-only entry should not be marked priority");
  });

  test("a second peer on the same object still produces exactly one entry, in the first peer's color", () => {
    const { registry, coloredOutline } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-a"));
  });

  test("the primary peer deselecting promotes the next peer's color", () => {
    const { registry, coloredOutline } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    registry.select("peer-a", null);

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-b"));
  });

  test("a peer deselecting entirely clears the entries", () => {
    const { registry, coloredOutline } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-a", null);

    assert.deepStrictEqual(lastEntries(coloredOutline), []);
  });

  test("multiple peers on different objects each produce their own entry", () => {
    const { selection, registry, coloredOutline } = createHarness();
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-2", meshB);

    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-2");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 2);
  });
});

describe("local selection", () => {
  test("produces its own entry, in selection.color, marked priority, alongside no peers", () => {
    const { selection, mesh, coloredOutline } = createHarness();
    selection.select("mesh-1");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].color, selection.color);
    assert.strictEqual(entries[0].priority, true);
  });

  test("wins over a peer's claim on the same object, using selection.color instead of the peer's", () => {
    const { selection, registry, coloredOutline } = createHarness();
    registry.select("peer-a", "mesh-1");
    selection.select("mesh-1");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, selection.color);
    assert.notStrictEqual(entries[0].color, registry.colorOf("peer-a"));
  });

  test("coexists with a peer's own entry on a different object, only the local one marked priority", () => {
    const { selection, registry, coloredOutline } = createHarness();
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-2", meshB);

    registry.select("peer-a", "mesh-2");
    selection.select("mesh-1");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 2);

    const localEntry = entries.find((entry) => entry.color === selection.color);
    const peerEntry = entries.find((entry) => entry.color === registry.colorOf("peer-a"));
    assert.strictEqual(localEntry?.priority, true);
    assert.ok(!peerEntry?.priority, "the peer's own entry should not be marked priority");
  });

  test("the peer's own color reappears once the local selection moves away", () => {
    const { selection, registry, coloredOutline } = createHarness();
    registry.select("peer-a", "mesh-1");
    selection.select("mesh-1");
    selection.select(null);

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-a"));
  });
});

describe("refresh", () => {
  test("recomputes and pushes entries on demand, without needing a peerSelectionChange/selectionChange event", () => {
    const { registry, coloredOutline, peerColoredOutline } = createHarness();
    registry.select("peer-a", "mesh-1");
    const callsBefore = coloredOutline.calls.length;

    peerColoredOutline.refresh();

    assert.strictEqual(coloredOutline.calls.length, callsBefore + 1);
    assert.strictEqual(lastEntries(coloredOutline)[0].color, registry.colorOf("peer-a"));
  });
});

describe("dispose", () => {
  test("stops mirroring further peerSelectionChange events", () => {
    const { registry, coloredOutline, peerColoredOutline } = createHarness();
    peerColoredOutline.dispose();
    const callsBefore = coloredOutline.calls.length;

    registry.select("peer-a", "mesh-1");

    assert.strictEqual(coloredOutline.calls.length, callsBefore);
  });

  test("stops mirroring further selectionChange events", () => {
    const { selection, registry, coloredOutline, peerColoredOutline } = createHarness();
    registry.select("peer-a", "mesh-1");
    peerColoredOutline.dispose();
    const callsBefore = coloredOutline.calls.length;

    selection.select("mesh-1");

    assert.strictEqual(coloredOutline.calls.length, callsBefore);
  });

  test("does not touch registry or selection state", () => {
    const { selection, registry, peerColoredOutline } = createHarness();
    registry.select("peer-a", "mesh-1");
    peerColoredOutline.dispose();

    assert.strictEqual(registry.selectionOf("peer-a"), "mesh-1");
    assert.doesNotThrow(() => selection.select(null));
  });
});
