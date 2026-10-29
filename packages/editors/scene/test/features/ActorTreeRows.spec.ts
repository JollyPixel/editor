// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type { Systems } from "@jolly-pixel/engine";
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  ActorTreeRows,
  ANCHOR_ICON,
  PREFAB_ICON
} from "../../src/features/hierarchy/ActorTreeRows.ts";
import { createSceneComponents } from "../helpers/sceneComponents.ts";

// CONSTANTS
const kNoAnchors: Pick<Systems.SceneAnchorsReader, "anchors"> = {
  anchors: () => [].values()
};
const kSpawn = { component: "map", key: "object:spawn" };

function mapAnchors(
  mapId: string,
  keys: string[]
): Pick<Systems.SceneAnchorsReader, "anchors"> {
  return {
    anchors: (actorId) => (actorId === mapId ? keys : []).map((key): Systems.SceneActorAnchor => {
      return {
        component: "map",
        anchor: {
          key,
          label: key.split(":")[1],
          kind: key.split(":")[0],
          pose: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        }
      };
    }).values()
  };
}

function anchoredScene() {
  const document = new SceneDocument();
  const mapId = document.addActor({
    name: "Map",
    components: [{ id: "map", type: "VoxelMap", data: {}, assets: {} }]
  })!;
  const heroId = document.addActor({ name: "Hero", parentId: mapId, anchor: kSpawn })!;
  const crateId = document.addActor({ name: "Crate", parentId: mapId })!;

  return { document, mapId, heroId, crateId };
}

describe("ActorTreeRows", () => {
  test("nests children, picks the icon of the first known component and badges peer selections", () => {
    const document = new SceneDocument();
    const rootId = document.addActor({ name: "Rig", visible: false })!;
    const childId = document.addActor({
      name: "Lamp",
      parentId: rootId,
      components: [
        { id: "script", type: "Script", data: {}, assets: {} },
        { id: "light", type: "Light", data: {}, assets: {} }
      ]
    })!;
    const peer = { clientId: "p", displayName: "Peer", color: "#ff0000" } as PresencePeer;

    const [root] = ActorTreeRows.read(
      document.tree,
      new Map([[childId, [peer]]]),
      createSceneComponents(),
      kNoAnchors
    ).roots;

    assert.strictEqual(root.icon, "actor-empty");
    assert.strictEqual(root.visible, false);
    assert.strictEqual(root.children?.length, 1);
    const [child] = root.children!;
    assert.strictEqual(child.label, "Lamp");
    assert.strictEqual(child.icon, "actor-light");
    assert.deepEqual(child.badges, [{ color: "#ff0000", title: "Peer" }]);
  });

  test("marks a prefab instance with the prefab icon", () => {
    const document = new SceneDocument();
    document.addActor({ name: "House", prefab: { id: "house", kind: "scene" } });

    const [row] = ActorTreeRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      kNoAnchors
    ).roots;

    assert.strictEqual(row.icon, PREFAB_ICON);
  });

  test("refuses a drop inside a prefab instance but keeps a drop beside it", () => {
    const document = new SceneDocument();
    const houseId = document.addActor({ name: "House", prefab: { id: "house", kind: "scene" } })!;
    const crateId = document.addActor({ name: "Crate" })!;

    const rows = ActorTreeRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      kNoAnchors
    );

    assert.strictEqual(rows.accepts({ movedIds: [crateId], targetId: houseId, where: "inside" }), false);
    assert.strictEqual(rows.accepts({ movedIds: [crateId], targetId: houseId, where: "above" }), true);
  });
});

describe("ActorTreeRows anchors", () => {
  test("lists a component's anchors ahead of the child actors and nests anchored actors under them", () => {
    const { document, mapId } = anchoredScene();

    const [map] = ActorTreeRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      mapAnchors(mapId, ["layer:ground", "object:spawn"])
    ).roots;

    assert.deepEqual(
      map.children?.map(({ label, icon, detail }) => [label, icon, detail]),
      [
        ["ground", ANCHOR_ICON, "layer"],
        ["spawn", ANCHOR_ICON, "object"],
        ["Crate", "actor-empty", undefined]
      ]
    );
    assert.strictEqual(map.children?.[0].renamable, false);
    assert.deepEqual(map.children?.[1].children?.map(({ label }) => label), ["Hero"]);
  });

  test("keeps the actors of an anchor the asset no longer has under a warning row", () => {
    const { document, mapId } = anchoredScene();

    const [map] = ActorTreeRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      mapAnchors(mapId, [])
    ).roots;

    const [missing] = map.children!;
    assert.strictEqual(missing.label, "Missing anchor");
    assert.ok(missing.warning);
    assert.deepEqual(missing.children?.map(({ label }) => label), ["Hero"]);
  });

  test("turns a drop on an anchor row into a move onto that anchor", () => {
    const { document, mapId, crateId } = anchoredScene();
    const rows = ActorTreeRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      mapAnchors(mapId, ["object:spawn"])
    );
    const [map] = rows.roots;
    const spawnRowId = map.children![0].id;

    assert.deepEqual(rows.anchorRow(spawnRowId), { ownerId: mapId, anchor: kSpawn });
    assert.deepEqual(rows.moves({ movedIds: [crateId], targetId: spawnRowId, where: "inside" }), [
      { id: crateId, parentId: mapId, anchor: kSpawn }
    ]);
    assert.deepEqual([...rows.ancestorIds(map.children![0].children![0].id)], [spawnRowId, mapId]);
  });

  test("refuses to drag an anchor row or to drop beside one", () => {
    const { document, mapId, crateId } = anchoredScene();
    const rows = ActorTreeRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      mapAnchors(mapId, ["object:spawn"])
    );
    const spawnRowId = rows.roots[0].children![0].id;

    assert.strictEqual(rows.accepts({ movedIds: [spawnRowId], targetId: crateId, where: "inside" }), false);
    assert.strictEqual(rows.accepts({ movedIds: [crateId], targetId: spawnRowId, where: "above" }), false);
    assert.deepEqual(rows.moves({ movedIds: [spawnRowId], targetId: crateId, where: "inside" }), []);
    assert.strictEqual(rows.accepts({ movedIds: [crateId], targetId: spawnRowId, where: "inside" }), true);
  });
});
