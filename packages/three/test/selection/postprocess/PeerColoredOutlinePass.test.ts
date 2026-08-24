// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerColoredOutlinePass,
  PeerSelectionVisibility,
  type ColoredOutlineEntry
} from "#src/index.ts";

/**
 * A spy standing in for a real `ColoredOutlinePass` - `PeerColoredOutlinePass`
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

function createHarness(
  options?: { visibility?: boolean; }
): {
  selection: SelectionManager;
  registry: PeerSelectionRegistry;
  coloredOutline: ReturnType<typeof createColoredOutlineSpy>;
  peerColoredOutline: PeerColoredOutlinePass;
  visibility: PeerSelectionVisibility | undefined;
  mesh: THREE.Mesh;
} {
  const selection = new SelectionManager();
  const registry = new PeerSelectionRegistry();
  const coloredOutline = createColoredOutlineSpy();
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

  const peerColoredOutline = new PeerColoredOutlinePass({
    registry,
    selection,
    coloredOutline,
    visibility
  });

  return {
    selection, registry, coloredOutline, peerColoredOutline, visibility, mesh
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

  test("a group target is pushed as its own entry too - not skipped the way a coloredOutline-technique mesh would be", () => {
    // `SelectionManager` still renders a local `SelectionBoundingBox` for a
    // group regardless of technique (see its own "coloredOutline technique"
    // test suite) - this is the other half of that: a group's local
    // selection is also pushed into `ColoredOutlinePass` unconditionally,
    // same as a mesh's, since `ColoredOutlinePass.setEntries` already
    // traverses a group entry to its own meshes. Both are intentional and
    // meant to render together for a group - the wireframe/fill box reads
    // as "this is a group", the per-mesh colored outline as "here's what's
    // in it and whose selection color it's in" - not a redundancy to
    // resolve by picking one.
    const { selection, coloredOutline } = createHarness();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    selection.register("group-1", group);

    selection.select("group-1");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, group);
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

describe("local hover", () => {
  test("produces its own entry, in selection.hoverColor, marked isolated not priority", () => {
    const { selection, mesh, coloredOutline } = createHarness();
    selection.hover("mesh-1");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].color, selection.hoverColor);
    assert.ok(!entries[0].priority, "a hover-only entry should not be marked priority");
    assert.strictEqual(entries[0].isolated, true);
  });

  test("is suppressed once the same object is also the local selection", () => {
    const { selection, coloredOutline } = createHarness();
    selection.hover("mesh-1");
    selection.select("mesh-1");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, selection.color);
    assert.strictEqual(entries[0].priority, true);
  });

  test("coexists with the local selection on a different object", () => {
    const { selection, coloredOutline } = createHarness();
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-2", meshB);

    selection.select("mesh-1");
    selection.hover("mesh-2");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 2);

    const hoverEntry = entries.find((entry) => entry.color === selection.hoverColor);
    assert.ok(hoverEntry, "expected a hover entry for mesh-2");
    assert.ok(!hoverEntry?.priority, "the hover entry should not be marked priority");
    assert.strictEqual(hoverEntry?.isolated, true);
  });
});

describe("visibility", () => {
  test("excludes a peer entry for an object visibility reports not visible", () => {
    const { registry, visibility, mesh, coloredOutline } = createHarness({ visibility: true });
    // Behind the camera.
    mesh.position.set(0, 0, 10);
    // `update()` only evaluates currently peer-selected ids (see its own doc
    // comment), so the selection must exist first - registers with the
    // default "unseen" visible=true, then this `update()` evaluates it for
    // real (a flip) and dispatches `visibilityChange`, which re-runs
    // `refresh()` and picks up the result.
    registry.select("peer-a", "mesh-1");
    visibility!.update();

    assert.deepStrictEqual(lastEntries(coloredOutline), []);
  });

  test("includes the peer entry again once visibility reports it visible", () => {
    const { registry, visibility, mesh, coloredOutline } = createHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");
    visibility!.update();
    assert.deepStrictEqual(lastEntries(coloredOutline), []);

    // Back in front of the camera.
    mesh.position.set(0, 0, -10);
    visibility!.update();

    assert.strictEqual(lastEntries(coloredOutline).length, 1);
  });

  test("never excludes the local selection or hover entries", () => {
    const { selection, visibility, mesh, coloredOutline } = createHarness({ visibility: true });
    // Behind the camera.
    mesh.position.set(0, 0, 10);
    visibility!.update();

    selection.select("mesh-1");

    const entries = lastEntries(coloredOutline);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].priority, true);
  });

  test("omitting visibility preserves always-included behavior", () => {
    const { registry, coloredOutline } = createHarness();
    registry.select("peer-a", "mesh-1");

    assert.strictEqual(lastEntries(coloredOutline).length, 1);
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
