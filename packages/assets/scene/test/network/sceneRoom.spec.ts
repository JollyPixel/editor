// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  LiveAssetRoom,
  mockAssetRoom
} from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import {
  sceneAssetKind,
  type SceneState
} from "#src/index.ts";
import type { SceneTree } from "#src/model/SceneTree.ts";
import { SceneTransform } from "#src/model/SceneTransform.ts";
import { sceneDocumentKind } from "#src/network/sceneDocumentKind.ts";
import type {
  SceneNetworkCommand,
  SceneSnapshot
} from "#src/network/types.ts";
import {
  actor,
  loadedTree,
  networkCommand,
  sampleActors,
  sceneFile
} from "../helpers/scene.ts";

function serverTree(
  server: LiveAssetRoom<SceneState, SceneNetworkCommand>
): SceneTree {
  return loadedTree(server.state.snapshot().actors);
}

function createRoom(): LiveAssetRoom<SceneState, SceneNetworkCommand> {
  const server = new LiveAssetRoom(sceneAssetKind());
  server.state.load(sceneFile(sampleActors()));
  server.connect("A");
  server.connect("B");

  return server;
}

function connectClient(
  server: LiveAssetRoom<SceneState, SceneNetworkCommand>,
  clientId: string
) {
  const room = mockAssetRoom<SceneNetworkCommand, SceneSnapshot>(clientId);
  const { document } = sceneDocumentKind().syncDocument(room);
  server.connect(clientId);

  return {
    document,
    deliver(): void {
      for (const message of server.take<SceneSnapshot>(clientId)) {
        room.deliver(message);
      }
    },
    flush(): void {
      for (const sent of room.sent.splice(0)) {
        server.receive(clientId, sent);
      }
    }
  };
}

describe("scene room", () => {
  test("keeps two peers' concurrent edits of different fields of one component", () => {
    const server = createRoom();

    server.receive("A", networkCommand({
      action: "component-changed",
      id: "light",
      data: { intensity: 2 }
    }, { clientId: "A", basis: 0 }));
    server.receive("B", networkCommand({
      action: "component-changed",
      id: "light",
      data: { color: "#ff0000" }
    }, { clientId: "B", basis: 0 }));

    assert.deepEqual(serverTree(server).component("light")?.data, {
      intensity: 2,
      color: "#ff0000"
    });
  });

  test("refuses an undo that would remove an actor a peer renamed since", () => {
    const server = createRoom();

    server.receive("A", networkCommand({
      action: "actor-renamed",
      id: "B",
      name: "Renamed"
    }, { clientId: "A" }));
    server.receive("B", networkCommand({
      action: "actor-removed",
      id: "A"
    }, { clientId: "B", basis: 0 }));

    assert.equal(serverTree(server).has("A"), true);
  });

  test("lets a removal without a basis win over earlier edits", () => {
    const server = createRoom();

    server.receive("A", networkCommand({
      action: "actor-renamed",
      id: "B",
      name: "Renamed"
    }, { clientId: "A" }));
    server.receive("B", networkCommand({
      action: "actor-removed",
      id: "A"
    }, { clientId: "B" }));

    assert.equal(serverTree(server).has("A"), false);
  });

  test("refuses an environment patch with a malformed color", () => {
    const server = createRoom();

    assert.throws(() => server.receive("A", networkCommand({
      action: "environment-changed",
      environment: { background: "red" }
    }, { clientId: "A" })), TypeError);
  });

  test("converges when a peer removes the parent of a pending local actor", () => {
    const server = createRoom();
    const client = connectClient(server, "C");
    client.deliver();

    client.document.addActor({ id: "D", name: "D", parentId: "A" });
    server.receive("A", networkCommand({ action: "actor-removed", id: "A" }, { clientId: "A" }));
    client.deliver();
    client.flush();
    client.deliver();

    assert.deepEqual(client.document.tree.toJSON(), server.state.snapshot());
    assert.equal(serverTree(server).has("D"), false);
  });

  test("converges on sibling order when a peer inserts before a pending move", () => {
    const server = createRoom();
    const client = connectClient(server, "C");
    client.deliver();

    client.document.move("C", { parentId: null }, {
      transform: SceneTransform.create(),
      beforeId: "A"
    });
    server.receive("A", networkCommand({
      action: "actor-added",
      actors: [actor("Z")],
      beforeId: "A"
    }, { clientId: "A" }));
    client.deliver();
    client.flush();
    client.deliver();

    assert.deepEqual(client.document.tree.toJSON(), server.state.snapshot());
    assert.deepEqual([...serverTree(server).actorIds()], ["Z", "C", "A", "B"]);
  });
});
