// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PeerEditContext } from "../../../../src/features/templates/editing/PeerEditContext.ts";
import { TemplateDraftId } from "../../../../src/document/TemplateDraftId.ts";
import {
  EditContext,
  PresenceStore,
  VoxelLayerRef
} from "../../../../src/state/index.ts";

function setup() {
  const world = new VoxelWorld(4);
  world.addLayer("Ground");
  world.addLayer("House draft", { id: "template-draft:house" });
  const context = new EditContext();
  const presence = new PresenceStore();
  const peers = new PeerEditContext({
    world,
    context,
    presence
  });

  return {
    context,
    presence,
    peers
  };
}

function peer(
  clientId: string
): PresencePeer {
  return {
    clientId,
    displayName: clientId,
    color: "#ff0000"
  };
}

describe("PeerEditContext", () => {
  test("shares the map with a peer on a map layer or with no selection", () => {
    const { presence, peers } = setup();
    presence.layerSelections = new Map([
      [new VoxelLayerRef("Ground").key, [peer("bob")]]
    ]);

    assert.equal(peers.shares("bob"), true);
    assert.equal(peers.shares("carol"), true);
  });

  test("shares a template only with the peers editing that template", () => {
    const { context, presence, peers } = setup();
    presence.layerSelections = new Map([
      [new VoxelLayerRef("House draft").key, [peer("bob")]],
      [new VoxelLayerRef("Ground").key, [peer("carol")]]
    ]);

    assert.equal(peers.shares("bob"), false);

    context.draft = new TemplateDraftId("house");

    assert.equal(peers.shares("bob"), true);
    assert.equal(peers.shares("carol"), false);
  });

  test("announces a change when the local context or the peer selections move", () => {
    const { context, presence, peers } = setup();
    let changes = 0;
    peers.subscribe("change", () => changes++);

    context.draft = new TemplateDraftId("house");
    presence.layerSelections = new Map();
    peers.dispose();
    context.draft = null;

    assert.equal(changes, 2);
  });
});
