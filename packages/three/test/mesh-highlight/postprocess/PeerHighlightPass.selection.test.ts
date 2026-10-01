// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  createPeerHighlightHarness,
  lastEntries
} from "./helpers.ts";
import { createBox } from "../peer/helpers.ts";

describe("peer selection", () => {
  test("one peer selecting a registered mesh produces exactly one entry in its color", () => {
    const { registry, highlight, mesh } = createPeerHighlightHarness();
    registry.select("peer-a", "mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-a"));
    assert.ok(!entries[0].priority, "a peer-only entry should not be marked priority");
  });

  test("a second peer on the same object still produces exactly one entry, in the first peer's color", () => {
    const { registry, highlight } = createPeerHighlightHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-a"));
  });

  test("the primary peer deselecting promotes the next peer's color", () => {
    const { registry, highlight } = createPeerHighlightHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    registry.select("peer-a", null);

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-b"));
  });

  test("a peer deselecting entirely clears the entries", () => {
    const { registry, highlight } = createPeerHighlightHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-a", null);

    assert.deepStrictEqual(lastEntries(highlight), []);
  });

  test("multiple peers on different objects each produce their own entry", () => {
    const { selection, registry, highlight } = createPeerHighlightHarness();
    selection.register("mesh-2", createBox());

    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-2");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 2);
  });
});

describe("local selection", () => {
  test("produces a priority entry in the local selection color", () => {
    const { selection, mesh, highlight } = createPeerHighlightHarness();
    selection.select("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].color, selection.appearance.selected.color);
    assert.strictEqual(entries[0].priority, true);
  });

  test(
    "a group target is pushed as its own entry too - not skipped the way a highlight-technique mesh would be",
    () => {
      const { selection, highlight } = createPeerHighlightHarness();
      const group = new THREE.Group();
      group.add(createBox());
      selection.register("group-1", group);

      selection.select("group-1");

      const entries = lastEntries(highlight);
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].target, group);
      assert.strictEqual(entries[0].color, selection.appearance.selected.color);
      assert.strictEqual(entries[0].priority, true);
    }
  );

  test("wins over a peer claim using the local selection color", () => {
    const { selection, registry, highlight } = createPeerHighlightHarness();
    registry.select("peer-a", "mesh-1");
    selection.select("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, selection.appearance.selected.color);
    assert.notStrictEqual(entries[0].color, registry.colorOf("peer-a"));
  });

  test("coexists with a peer's own entry on a different object, only the local one marked priority", () => {
    const { selection, registry, highlight } = createPeerHighlightHarness();
    selection.register("mesh-2", createBox());

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
    const { selection, registry, highlight } = createPeerHighlightHarness();
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
    const { selection, mesh, highlight } = createPeerHighlightHarness();
    selection.hover("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].color, selection.appearance.hovered.color);
    assert.ok(!entries[0].priority, "a hover-only entry should not be marked priority");
    assert.strictEqual(entries[0].isolated, true);
  });

  test("is suppressed once the same object is also the local selection", () => {
    const { selection, highlight } = createPeerHighlightHarness();
    selection.hover("mesh-1");
    selection.select("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, selection.appearance.selected.color);
    assert.strictEqual(entries[0].priority, true);
  });

  test("coexists with the local selection on a different object", () => {
    const { selection, highlight } = createPeerHighlightHarness();
    selection.register("mesh-2", createBox());

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
