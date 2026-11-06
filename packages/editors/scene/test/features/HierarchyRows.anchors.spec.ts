// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { HierarchyRows } from "../../src/features/hierarchy/HierarchyRows.ts";
import type { SceneLiveView } from "../../src/editing/SceneEditing.ts";
import { createSceneComponents } from "../helpers/sceneComponents.ts";

type LiveRows = Pick<SceneLiveView, "anchors" | "expandedActors">;

// CONSTANTS
const kNoAnchors: LiveRows = {
  anchors: () => [].values(),
  expandedActors: () => [].values()
};
const kSpawn = { component: "map", key: "object:spawn" };
const kMapRowId = HierarchyRows.componentRowId("map");

function mapAnchors(
  mapId: string,
  keys: string[]
): LiveRows {
  return {
    expandedActors: () => [].values(),
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

describe("HierarchyRows anchors", () => {
  test("lists a component's anchors under its row and nests anchored actors under them", () => {
    const { document, mapId } = anchoredScene();

    const [map] = HierarchyRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      mapAnchors(mapId, ["layer:ground", "object:spawn"])
    ).roots;

    assert.deepEqual(map.children?.map(({ id, label }) => [id, label]), [
      [kMapRowId, "VoxelMap"],
      [map.children![1].id, "Crate"]
    ]);
    const [component] = map.children!;
    assert.deepEqual(
      component.children?.map(({ label, icon, detail, renamable }) => [label, icon, detail, renamable]),
      [
        ["ground", "actor-anchor", "layer", false],
        ["spawn", "actor-anchor", "object", false]
      ]
    );
    assert.deepEqual(component.children?.[1].children?.map(({ label }) => label), ["Hero"]);
  });

  test("keeps the actors of an anchor the asset no longer has under a warning row", () => {
    const { document, mapId } = anchoredScene();

    const [map] = HierarchyRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      mapAnchors(mapId, [])
    ).roots;

    const [missing] = map.children![0].children!;
    assert.strictEqual(missing.label, "Missing anchor");
    assert.ok(missing.warning);
    assert.deepEqual(missing.children?.map(({ label }) => label), ["Hero"]);
  });

  test("keeps the actors of an anchor whose component is gone under a warning row on the owner", () => {
    const document = new SceneDocument();
    const mapId = document.addActor({ name: "Map" })!;
    document.addActor({ name: "Hero", parentId: mapId, anchor: kSpawn });

    const [map] = HierarchyRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      kNoAnchors
    ).roots;

    const [missing] = map.children!;
    assert.strictEqual(missing.label, "Missing anchor");
    assert.deepEqual(missing.children?.map(({ label }) => label), ["Hero"]);
  });

  test("turns a drop on an anchor row into a move onto that anchor", () => {
    const { document, mapId, crateId, heroId } = anchoredScene();
    const rows = HierarchyRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      mapAnchors(mapId, ["object:spawn"])
    );
    const spawnRowId = HierarchyRows.anchorRowId({ ownerId: mapId, anchor: kSpawn });

    assert.deepEqual(rows.anchorRow(spawnRowId), { ownerId: mapId, anchor: kSpawn });
    assert.deepEqual(rows.drop({ movedIds: [crateId], targetId: spawnRowId, where: "inside" }), {
      kind: "actors",
      moves: [{ id: crateId, parentId: mapId, anchor: kSpawn }]
    });
    assert.deepEqual([...rows.ancestorIds(heroId)], [spawnRowId, kMapRowId, mapId]);
  });

  test("refuses to drag an anchor row or to drop beside one", () => {
    const { document, mapId, crateId } = anchoredScene();
    const rows = HierarchyRows.read(
      document.tree,
      new Map(),
      createSceneComponents(),
      mapAnchors(mapId, ["object:spawn"])
    );
    const spawnRowId = HierarchyRows.anchorRowId({ ownerId: mapId, anchor: kSpawn });

    assert.strictEqual(rows.accepts({ movedIds: [spawnRowId], targetId: crateId, where: "inside" }), false);
    assert.strictEqual(rows.accepts({ movedIds: [crateId], targetId: spawnRowId, where: "above" }), false);
    assert.strictEqual(rows.drop({ movedIds: [spawnRowId], targetId: crateId, where: "inside" }), null);
    assert.strictEqual(rows.accepts({ movedIds: [crateId], targetId: spawnRowId, where: "inside" }), true);
  });
});
