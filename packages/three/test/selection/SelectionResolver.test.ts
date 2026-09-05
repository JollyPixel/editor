// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  PeerHoverRegistry,
  PeerSelectionRegistry,
  SelectionManager,
  SelectionResolver
} from "#src/index.ts";

function createHarness(): {
  selection: SelectionManager;
  selections: PeerSelectionRegistry;
  hovers: PeerHoverRegistry;
  resolver: SelectionResolver;
} {
  const selection = new SelectionManager({
    appearance: {
      selected: {
        color: "#ffffff"
      },
      hovered: {
        color: "#00ff00",
        opacity: 0.4
      }
    },
    renderOverlays: false
  });
  selection.register("box", new THREE.Mesh());
  selection.register("sphere", new THREE.Mesh());

  const allocator = {
    colorOf: (peerId: string) => (peerId === "peer-a" ? "#ff0000" : "#0000ff"),
    release: () => void 0
  };
  const selections = new PeerSelectionRegistry({
    colorAllocator: allocator
  });
  const hovers = new PeerHoverRegistry({
    colorAllocator: allocator
  });

  return {
    selection,
    selections,
    hovers,
    resolver: new SelectionResolver({
      selection,
      peerSelections: selections,
      peerHovers: hovers
    })
  };
}

describe("SelectionResolver", () => {
  test("applies the same priority policy to every renderer", () => {
    const { selection, selections, hovers, resolver } = createHarness();
    hovers.hover("peer-a", "box");
    selection.hover("box");
    selections.select("peer-b", "box");
    selection.select("box");

    const [indicator] = resolver.resolve();

    assert.strictEqual(indicator.objectId, "box");
    assert.strictEqual(indicator.role, "selection");
    assert.strictEqual(indicator.source, "local");
    assert.strictEqual(indicator.color, "#ffffff");
  });

  test("resolves one primary peer per object", () => {
    const { selections, resolver } = createHarness();
    selections.select("peer-a", "box");
    selections.select("peer-b", "box");

    const [indicator] = resolver.resolve();

    assert.strictEqual(indicator.peerId, "peer-a");
    assert.strictEqual(indicator.color, "#ff0000");
    assert.strictEqual(indicator.source, "peer");
  });

  test("keeps local hover and peer selection on separate objects", () => {
    const { selection, selections, resolver } = createHarness();
    selection.hover("box");
    selections.select("peer-a", "sphere");

    const indicators = resolver.resolve();

    assert.deepStrictEqual(
      indicators.map(({ objectId, role, source }) => {
        return { objectId, role, source };
      }),
      [
        { objectId: "box", role: "hover", source: "local" },
        { objectId: "sphere", role: "selection", source: "peer" }
      ]
    );
  });
});
