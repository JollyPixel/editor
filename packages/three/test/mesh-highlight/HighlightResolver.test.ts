// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PeerHighlights } from "#src/index.ts";
import { MeshHighlightState } from "#src/mesh-highlight/MeshHighlightState.ts";
import { HighlightResolver } from "#src/mesh-highlight/HighlightResolver.ts";
import { PeerVisibility } from "#src/mesh-highlight/peer/PeerVisibility.ts";
import { createFrontCamera } from "./peer/helpers.ts";

function createHarness(
  options: { visibility?: boolean; } = {}
): {
  state: MeshHighlightState;
  peers: PeerHighlights;
  visibility: PeerVisibility | undefined;
  resolver: HighlightResolver;
} {
  const state = new MeshHighlightState({
    appearance: {
      selected: {
        color: "#ffffff"
      },
      hovered: {
        color: "#00ff00",
        opacity: 0.4
      }
    }
  });
  state.register("box", new THREE.Mesh(new THREE.BoxGeometry()));
  state.register("sphere", new THREE.Mesh(new THREE.BoxGeometry()));

  const peers = new PeerHighlights({
    colorAllocator: {
      peerColor: (peerId) => (peerId === "peer-a" ? "#ff0000" : "#0000ff"),
      release: () => void 0
    }
  });
  const visibility = options.visibility ?
    new PeerVisibility({
      peers,
      state,
      camera: createFrontCamera()
    }) :
    undefined;

  return {
    state,
    peers,
    visibility,
    resolver: new HighlightResolver({
      state,
      peers,
      visibility
    })
  };
}

function summarize(
  resolver: HighlightResolver
) {
  return resolver.resolve().map(({ objectId, role, source, peerId }) => {
    return { objectId, role, source, peerId };
  });
}

describe("HighlightResolver", () => {
  test("resolves overlapping local and peer intent to one local selection", () => {
    const { state, peers, resolver } = createHarness();
    peers.hover("peer-a", "box");
    state.hover("box");
    peers.select("peer-b", "box");
    state.select("box");

    const indicators = resolver.resolve();
    const [indicator] = indicators;

    assert.strictEqual(indicators.length, 1);
    assert.strictEqual(indicator.objectId, "box");
    assert.strictEqual(indicator.role, "selection");
    assert.strictEqual(indicator.source, "local");
    assert.strictEqual(indicator.color, "#ffffff");
  });

  test("ranks a peer's selection above a local hover on the same object", () => {
    const { state, peers, resolver } = createHarness();
    state.hover("box");
    peers.select("peer-a", "box");

    assert.deepStrictEqual(summarize(resolver), [
      { objectId: "box", role: "selection", source: "peer", peerId: "peer-a" }
    ]);
  });

  test("ranks a local hover or emphasis above a peer's hover", () => {
    const { state, peers, resolver } = createHarness();
    state.hover("box");
    state.emphasize(["sphere"]);
    peers.hover("peer-a", "box");
    peers.hover("peer-b", "sphere");

    assert.deepStrictEqual(summarize(resolver), [
      { objectId: "box", role: "hover", source: "local", peerId: undefined },
      { objectId: "sphere", role: "hover", source: "local", peerId: undefined }
    ]);
  });

  test("colors a shared object after its first peer", () => {
    const { peers, resolver } = createHarness();
    peers.select("peer-a", "box");
    peers.select("peer-b", "box");

    const [indicator] = resolver.resolve();

    assert.strictEqual(indicator.peerId, "peer-a");
    assert.strictEqual(indicator.color, "#ff0000");
    assert.strictEqual(indicator.source, "peer");
  });

  test("draws a peer's hover at the hover opacity when nothing else claims the object", () => {
    const { peers, resolver } = createHarness();
    peers.hover("peer-b", "sphere");

    const [indicator] = resolver.resolve();

    assert.deepStrictEqual(
      {
        role: indicator.role,
        source: indicator.source,
        color: indicator.color,
        opacity: indicator.opacity
      },
      {
        role: "hover",
        source: "peer",
        color: "#0000ff",
        opacity: 0.4
      }
    );
  });

  test("drops peer indicators on culled objects and keeps the local hover", () => {
    const { state, peers, visibility, resolver } = createHarness({ visibility: true });
    state.findTarget("box")!.position.set(0, 0, 10);
    state.findTarget("sphere")!.position.set(0, 0, 10);
    state.hover("box");
    peers.select("peer-a", "box");
    peers.hover("peer-b", "sphere");

    visibility!.update();

    assert.deepStrictEqual(summarize(resolver), [
      { objectId: "box", role: "hover", source: "local", peerId: undefined }
    ]);
  });

  test("uses the per-object technique over the default one", () => {
    const { state, resolver } = createHarness();
    state.register("sphere", state.findTarget("sphere")!, { technique: "silhouette" });
    state.select("box");
    state.hover("sphere");

    assert.deepStrictEqual(
      resolver.resolve().map(({ objectId, technique }) => {
        return { objectId, technique };
      }),
      [
        { objectId: "box", technique: "outline" },
        { objectId: "sphere", technique: "silhouette" }
      ]
    );
  });
});
