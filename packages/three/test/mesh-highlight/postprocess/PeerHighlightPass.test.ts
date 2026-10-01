// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createPeerHighlightHarness,
  lastEntries
} from "./helpers.ts";

describe("visibility", () => {
  test("excludes a peer entry for an object visibility reports not visible", () => {
    const { registry, visibility, mesh, highlight } = createPeerHighlightHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");
    visibility!.update();

    assert.deepStrictEqual(lastEntries(highlight), []);
  });

  test("includes the peer entry again once visibility reports it visible", () => {
    const { registry, visibility, mesh, highlight } = createPeerHighlightHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");
    visibility!.update();
    assert.deepStrictEqual(lastEntries(highlight), []);

    mesh.position.set(0, 0, -10);
    visibility!.update();

    assert.strictEqual(lastEntries(highlight).length, 1);
  });

  test("never excludes the local selection or hover entries of a culled object", () => {
    const {
      selection,
      registry,
      visibility,
      mesh,
      highlight
    } = createPeerHighlightHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");
    visibility!.update();
    assert.strictEqual(visibility!.isVisible("mesh-1"), false);

    selection.hover("mesh-1");
    const hoverEntries = lastEntries(highlight);
    assert.strictEqual(hoverEntries.length, 1);
    assert.strictEqual(hoverEntries[0].isolated, true);

    selection.select("mesh-1");
    const selectionEntries = lastEntries(highlight);
    assert.strictEqual(selectionEntries.length, 1);
    assert.strictEqual(selectionEntries[0].priority, true);
  });

  test("excludes a peer hover entry for an object visibility reports not visible", () => {
    const { hoverRegistry, visibility, mesh, highlight } = createPeerHighlightHarness({
      visibility: true,
      hover: true
    });
    mesh.position.set(0, 0, 10);
    hoverRegistry!.hover("peer-a", "mesh-1");
    visibility!.update();

    assert.deepStrictEqual(lastEntries(highlight), []);
  });
});

describe("refresh", () => {
  test(
    "recomputes and pushes entries on demand, without needing a peerSelectionChange/selectionChange event",
    () => {
      const { registry, highlight, peerHighlight } = createPeerHighlightHarness();
      registry.select("peer-a", "mesh-1");
      const callsBefore = highlight.calls.length;

      peerHighlight.refresh();

      assert.strictEqual(highlight.calls.length, callsBefore + 1);
      assert.strictEqual(lastEntries(highlight)[0].color, registry.colorOf("peer-a"));
    }
  );
});

describe("dispose", () => {
  test("clears the entries it owns", () => {
    const { registry, highlight, peerHighlight } = createPeerHighlightHarness();
    registry.select("peer-a", "mesh-1");

    peerHighlight.dispose();

    assert.deepStrictEqual(lastEntries(highlight), []);
  });

  test("stops mirroring further peerSelectionChange events", () => {
    const { registry, highlight, peerHighlight } = createPeerHighlightHarness();
    peerHighlight.dispose();
    const callsBefore = highlight.calls.length;

    registry.select("peer-a", "mesh-1");

    assert.strictEqual(highlight.calls.length, callsBefore);
  });

  test("stops mirroring further selectionChange events", () => {
    const { selection, registry, highlight, peerHighlight } = createPeerHighlightHarness();
    registry.select("peer-a", "mesh-1");
    peerHighlight.dispose();
    const callsBefore = highlight.calls.length;

    selection.select("mesh-1");

    assert.strictEqual(highlight.calls.length, callsBefore);
  });

  test("does not touch registry or selection state", () => {
    const { selection, registry, peerHighlight } = createPeerHighlightHarness();
    registry.select("peer-a", "mesh-1");
    selection.select("mesh-1");

    peerHighlight.dispose();

    assert.strictEqual(registry.selectionOf("peer-a"), "mesh-1");
    assert.strictEqual(selection.selected, "mesh-1");
  });
});
