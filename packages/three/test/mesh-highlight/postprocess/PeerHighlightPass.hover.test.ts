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

function lightnessOf(
  color: THREE.ColorRepresentation
): number {
  return new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l;
}

describe("peer hover", () => {
  test("one peer hovering a registered mesh produces exactly one isolated, darkened entry", () => {
    const { hoverRegistry, mesh, highlight } = createPeerHighlightHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].target, mesh);
    assert.strictEqual(entries[0].isolated, true);
    assert.ok(!entries[0].priority, "a peer hover entry should not be marked priority");
    assert.ok(
      lightnessOf(entries[0].color) < lightnessOf(hoverRegistry!.colorOf("peer-a")),
      "must be darkened, not the raw peer color"
    );
  });

  test("priority rule: a peer selection on the object suppresses another peer's hover entry", () => {
    const { registry, hoverRegistry, highlight } = createPeerHighlightHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, registry.colorOf("peer-b"));
    assert.ok(!entries[0].isolated, "the surviving entry is the peer selection, not a hover");
  });

  test("priority rule: the local selection suppresses a peer's hover entry", () => {
    const { selection, hoverRegistry, highlight } = createPeerHighlightHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");
    selection.select("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, selection.appearance.selected.color);
    assert.strictEqual(entries[0].priority, true);
  });

  test("priority rule: the local hover wins over a peer's hover on the same object", () => {
    const { selection, hoverRegistry, highlight } = createPeerHighlightHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");
    selection.hover("mesh-1");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].color, selection.appearance.hovered.color);
    assert.strictEqual(entries[0].isolated, true);
  });

  test("priority rule: the oldest peer hoverer wins over a later one", () => {
    const { hoverRegistry, highlight } = createPeerHighlightHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");
    const afterFirst = lastEntries(highlight)[0].color;

    hoverRegistry!.hover("peer-b", "mesh-1");

    assert.strictEqual(lastEntries(highlight).length, 1);
    assert.deepStrictEqual(
      lastEntries(highlight)[0].color,
      afterFirst,
      "must stay in the first peer's darkened color"
    );
  });

  test("a peer hover entry reappears once the suppressing selector clears", () => {
    const { registry, hoverRegistry, highlight } = createPeerHighlightHarness({ hover: true });
    hoverRegistry!.hover("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    registry.select("peer-b", null);

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].isolated, true);
  });

  test("coexists with a peer selection and a peer hover on separate objects", () => {
    const { selection, registry, hoverRegistry, highlight } = createPeerHighlightHarness({ hover: true });
    const meshC = createBox();
    selection.register("mesh-2", createBox());
    selection.register("mesh-3", meshC);

    registry.select("peer-a", "mesh-2");
    hoverRegistry!.hover("peer-b", "mesh-3");

    const entries = lastEntries(highlight);
    assert.strictEqual(entries.length, 2);
    const hoverEntry = entries.find((entry) => entry.target === meshC);
    assert.strictEqual(hoverEntry?.isolated, true);
  });
});
