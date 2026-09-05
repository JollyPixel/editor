// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerHoverRegistry,
  PeerHighlightPass,
  PeerSelectionVisibility,
  type HighlightEntry
} from "#src/index.ts";

/**
 * A spy standing in for a real `HighlightPass` - `PeerHighlightPass`
 * only writes `entries` on it, so a real instance (which needs a
 * `THREE.WebGPURenderer`) isn't needed to test the wiring logic here.
 */
function createHighlightSpy(): {
  entries: HighlightEntry[];
  calls: HighlightEntry[][];
} {
  const calls: HighlightEntry[][] = [];

  return {
    set entries(entries: HighlightEntry[]) {
      calls.push(entries);
    },
    get entries(): HighlightEntry[] {
      return calls.at(-1) ?? [];
    },
    calls
  };
}

function createHarness(
  options?: { visibility?: boolean; hover?: boolean; }
): {
  selection: SelectionManager;
  registry: PeerSelectionRegistry;
  hoverRegistry: PeerHoverRegistry | undefined;
  highlight: ReturnType<typeof createHighlightSpy>;
  peerHighlight: PeerHighlightPass;
  visibility: PeerSelectionVisibility | undefined;
  mesh: THREE.Mesh;
} {
  const selection = new SelectionManager();
  const registry = new PeerSelectionRegistry();
  const hoverRegistry = options?.hover ? new PeerHoverRegistry() : undefined;
  const highlight = createHighlightSpy();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

  selection.register("mesh-1", mesh);

  let visibility: PeerSelectionVisibility | undefined;
  if (options?.visibility) {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld();
    visibility = new PeerSelectionVisibility({ registry, selection, camera, hoverRegistry });
  }

  const peerHighlight = new PeerHighlightPass({
    registry,
    selection,
    highlight,
    visibility,
    hoverRegistry
  });

  return {
    selection, registry, hoverRegistry, highlight, peerHighlight, visibility, mesh
  };
}

function lastEntries(
  spy: ReturnType<typeof createHighlightSpy>
): HighlightEntry[] {
  return spy.calls.at(-1) ?? [];
}

describe("peer selection", () => {
  test("one peer selecting a registered mesh produces exactly one entry in its color", () => {
    const { registry, highlight, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-a"));
    assert.ok(!entries[0].priority, "a peer-only entry should not be marked priority");
  });

  test("a second peer on the same object still produces exactly one entry, in the first peer's color", () => {
    const { registry, highlight } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-a"));
  });

  test("the primary peer deselecting promotes the next peer's color", () => {
    const { registry, highlight } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    registry.select("peer-a", null);

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-b"));
  });

  test("a peer deselecting entirely clears the entries", () => {
    const { registry, highlight } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-a", null);

    assert.deepStrictEqual(lastEntries(highlight), []);
  });

  test("multiple peers on different objects each produce their own entry", () => {
    const { selection, registry, highlight } = createHarness();
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-2", meshB);

    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-2");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 2);
  });
});

describe("local selection", () => {
  test("produces a priority entry in the local selection color", () => {
    const { selection, mesh, highlight } = createHarness();
    selection.select("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].color, selection.appearance.selected.color);
    assert.strictEqual(entries[0].priority, true);
  });

  test("a group target is pushed as its own entry too - not skipped the way a highlight-technique mesh would be", () => {
    // `SelectionManager` still renders a local `SelectionBoundingBox` for a
    // group regardless of technique (see its own "highlight technique"
    // test suite) - this is the other half of that: a group's local
    // selection is also pushed into `HighlightPass` unconditionally,
    // same as a mesh's, since the HighlightPass entries setter already
    // traverses a group entry to its own meshes. Both are intentional and
    // meant to render together for a group - the wireframe/fill box reads
    // as "this is a group", the per-mesh colored outline as "here's what's
    // in it and whose selection color it's in" - not a redundancy to
    // resolve by picking one.
    const { selection, highlight } = createHarness();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    selection.register("group-1", group);

    selection.select("group-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, group);
    assert.strictEqual(entries[0].color, selection.appearance.selected.color);
    assert.strictEqual(entries[0].priority, true);
  });

  test("wins over a peer claim using the local selection color", () => {
    const { selection, registry, highlight } = createHarness();
    registry.select("peer-a", "mesh-1");
    selection.select("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, selection.appearance.selected.color);
    assert.notStrictEqual(entries[0].color, registry.colorOf("peer-a"));
  });

  test("coexists with a peer's own entry on a different object, only the local one marked priority", () => {
    const { selection, registry, highlight } = createHarness();
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-2", meshB);

    registry.select("peer-a", "mesh-2");
    selection.select("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 2);

    const localEntry = entries.find((entry) => entry.color === selection.appearance.selected.color);
    const peerEntry = entries.find((entry) => entry.color === registry.colorOf("peer-a"));
    assert.strictEqual(localEntry?.priority, true);
    assert.ok(!peerEntry?.priority, "the peer's own entry should not be marked priority");
  });

  test("the peer's own color reappears once the local selection moves away", () => {
    const { selection, registry, highlight } = createHarness();
    registry.select("peer-a", "mesh-1");
    selection.select("mesh-1");
    selection.select(null);

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-a"));
  });
});

describe("local hover", () => {
  test("produces an isolated entry in the local hover color", () => {
    const { selection, mesh, highlight } = createHarness();
    selection.hover("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].color, selection.appearance.hovered.color);
    assert.ok(!entries[0].priority, "a hover-only entry should not be marked priority");
    assert.strictEqual(entries[0].isolated, true);
  });

  test("is suppressed once the same object is also the local selection", () => {
    const { selection, highlight } = createHarness();
    selection.hover("mesh-1");
    selection.select("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, selection.appearance.selected.color);
    assert.strictEqual(entries[0].priority, true);
  });

  test("coexists with the local selection on a different object", () => {
    const { selection, highlight } = createHarness();
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-2", meshB);

    selection.select("mesh-1");
    selection.hover("mesh-2");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 2);

    const hoverEntry = entries.find((entry) => entry.color === selection.appearance.hovered.color);
    assert.ok(hoverEntry, "expected a hover entry for mesh-2");
    assert.ok(!hoverEntry?.priority, "the hover entry should not be marked priority");
    assert.strictEqual(hoverEntry?.isolated, true);
  });
});

describe("peer hover", () => {
  test("one peer hovering a registered mesh produces exactly one isolated, darkened entry", () => {
    const { hoverRegistry, mesh, highlight } = createHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].isolated, true);
    assert.ok(!entries[0].priority, "a peer hover entry should not be marked priority");
    assert.notStrictEqual(entries[0].color, hoverRegistry!.colorOf("peer-a"), "must be darkened, not the raw peer color");
  });

  test("without a hoverRegistry, a peer hover is never included - unchanged behavior", () => {
    // No `hover: true` here - `createHarness`'s default omits `hoverRegistry`
    // entirely, matching an existing caller that hasn't opted in.
    const { registry, highlight } = createHarness();
    registry.select("peer-a", "mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-a"));
  });

  test("priority rule: a peer selection on the object suppresses another peer's hover entry", () => {
    const { registry, hoverRegistry, highlight } = createHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-b"));
    assert.ok(!entries[0].isolated, "the surviving entry is the peer selection, not a hover");
  });

  test("priority rule: the local selection suppresses a peer's hover entry", () => {
    const { selection, hoverRegistry, highlight } = createHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");
    selection.select("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, selection.appearance.selected.color);
    assert.strictEqual(entries[0].priority, true);
  });

  test("priority rule: the local hover wins over a peer's hover on the same object", () => {
    const { selection, hoverRegistry, highlight } = createHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");
    selection.hover("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, selection.appearance.hovered.color);
    assert.strictEqual(entries[0].isolated, true);
  });

  test("priority rule: the oldest peer hoverer wins over a later one", () => {
    const { hoverRegistry, highlight } = createHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");
    const afterFirst = lastEntries(highlight)[0].color;

    hoverRegistry!.hover("peer-b", "mesh-1");

    assert.strictEqual(lastEntries(highlight).length, 1);
    // `#darken` returns a fresh `THREE.Color` per call - compare by value,
    // not identity.
    assert.deepStrictEqual(lastEntries(highlight)[0].color, afterFirst, "must stay in the first peer's darkened color");
  });

  test("a peer hover entry reappears once the suppressing selector clears", () => {
    const { registry, hoverRegistry, highlight } = createHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    registry.select("peer-b", null);

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].isolated, true);
  });

  test("coexists with a peer selection and local hover on separate objects", () => {
    const { selection, registry, hoverRegistry, highlight } = createHarness({ hover: true });
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const meshC = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-2", meshB);
    selection.register("mesh-3", meshC);

    registry.select("peer-a", "mesh-2");
    hoverRegistry!.hover("peer-b", "mesh-3");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 2);
    const hoverEntry = entries.find((entry) => entry.target === meshC);
    assert.strictEqual(hoverEntry?.isolated, true);
  });
});

describe("visibility", () => {
  test("excludes a peer entry for an object visibility reports not visible", () => {
    const { registry, visibility, mesh, highlight } = createHarness({ visibility: true });
    // Behind the camera.
    mesh.position.set(0, 0, 10);
    // `update()` only evaluates currently peer-selected ids (see its own doc
    // comment), so the selection must exist first - registers with the
    // default "unseen" visible=true, then this `update()` evaluates it for
    // real (a flip) and dispatches `visibilityChange`, which re-runs
    // `refresh()` and picks up the result.
    registry.select("peer-a", "mesh-1");
    visibility!.update();

    assert.deepStrictEqual(lastEntries(highlight), []);
  });

  test("includes the peer entry again once visibility reports it visible", () => {
    const { registry, visibility, mesh, highlight } = createHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");
    visibility!.update();
    assert.deepStrictEqual(lastEntries(highlight), []);

    // Back in front of the camera.
    mesh.position.set(0, 0, -10);
    visibility!.update();

    assert.strictEqual(lastEntries(highlight).length, 1);
  });

  test("never excludes the local selection or hover entries", () => {
    const { selection, visibility, mesh, highlight } = createHarness({ visibility: true });
    // Behind the camera.
    mesh.position.set(0, 0, 10);
    visibility!.update();

    selection.select("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].priority, true);
  });

  test("omitting visibility preserves always-included behavior", () => {
    const { registry, highlight } = createHarness();
    registry.select("peer-a", "mesh-1");

    assert.strictEqual(lastEntries(highlight).length, 1);
  });

  test("excludes a peer hover entry for an object visibility reports not visible", () => {
    const { hoverRegistry, visibility, mesh, highlight } = createHarness({ visibility: true, hover: true });
    mesh.position.set(0, 0, 10);
    hoverRegistry!.hover("peer-a", "mesh-1");
    visibility!.update();

    assert.deepStrictEqual(lastEntries(highlight), []);
  });
});

describe("refresh", () => {
  test("recomputes and pushes entries on demand, without needing a peerSelectionChange/selectionChange event", () => {
    const { registry, highlight, peerHighlight } = createHarness();
    registry.select("peer-a", "mesh-1");
    const callsBefore = highlight.calls.length;

    peerHighlight.refresh();

    assert.strictEqual(highlight.calls.length, callsBefore + 1);
    assert.strictEqual(lastEntries(highlight)[0].color, registry.colorOf("peer-a"));
  });
});

describe("dispose", () => {
  test("clears the entries it owns", () => {
    const { registry, highlight, peerHighlight } = createHarness();
    registry.select("peer-a", "mesh-1");

    peerHighlight.dispose();

    assert.deepStrictEqual(lastEntries(highlight), []);
  });

  test("stops mirroring further peerSelectionChange events", () => {
    const { registry, highlight, peerHighlight } = createHarness();
    peerHighlight.dispose();
    const callsBefore = highlight.calls.length;

    registry.select("peer-a", "mesh-1");

    assert.strictEqual(highlight.calls.length, callsBefore);
  });

  test("stops mirroring further selectionChange events", () => {
    const { selection, registry, highlight, peerHighlight } = createHarness();
    registry.select("peer-a", "mesh-1");
    peerHighlight.dispose();
    const callsBefore = highlight.calls.length;

    selection.select("mesh-1");

    assert.strictEqual(highlight.calls.length, callsBefore);
  });

  test("does not touch registry or selection state", () => {
    const { selection, registry, peerHighlight } = createHarness();
    registry.select("peer-a", "mesh-1");
    peerHighlight.dispose();

    assert.strictEqual(registry.selectionOf("peer-a"), "mesh-1");
    assert.doesNotThrow(() => selection.select(null));
  });
});
