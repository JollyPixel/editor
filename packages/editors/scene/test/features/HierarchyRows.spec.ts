// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type { Systems } from "@jolly-pixel/engine";
import {
  PeerMarks,
  type PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  HierarchyRows,
  PREFAB_ICON
} from "../../src/features/hierarchy/HierarchyRows.ts";
import type { SceneLiveView } from "../../src/editing/SceneEditing.ts";
import { readRows } from "../helpers/hierarchy/hierarchyRows.ts";

type LiveRows = Pick<SceneLiveView, "anchors" | "expandedActors">;

// CONSTANTS
const kNoAnchors: LiveRows = {
  anchors: () => [].values(),
  expandedActors: () => [].values()
};
const kCameraRow = HierarchyRows.componentRowId("camera");
const kBodyRow = HierarchyRows.componentRowId("body");

function litScene() {
  const document = new SceneDocument();
  const lampId = document.addActor({
    name: "Lamp",
    components: [
      { id: "light", type: "Light", data: {}, assets: {} },
      { id: "body", type: "RigidBody", data: {}, assets: {} },
      { id: "camera", type: "Camera", data: {}, assets: {} }
    ]
  })!;
  const bulbId = document.addActor({
    name: "Bulb",
    parentId: lampId,
    components: [{ id: "mesh", type: "Mesh", data: {}, assets: {} }]
  })!;
  const rows = readRows(document.tree, kNoAnchors);

  return { rows, lampId, bulbId };
}

describe("HierarchyRows", () => {
  test("lists an actor's components ahead of its child actors and badges peer selections on actors", () => {
    const document = new SceneDocument();
    const rootId = document.addActor({ name: "Rig", visible: false })!;
    const childId = document.addActor({
      name: "Lamp",
      parentId: rootId,
      components: [
        { id: "light", type: "Light", data: {}, assets: {} },
        { id: "gone", type: "Unknown", data: {}, assets: {} }
      ]
    })!;
    document.addActor({ name: "Bulb", parentId: childId });
    const peer: PresencePeer = { clientId: "p", displayName: "Peer", color: "#ff0000" };

    const rows = readRows(document.tree, kNoAnchors, {
      marks: new PeerMarks([[peer, childId]])
    });

    const [root] = rows.roots;
    assert.strictEqual(root.icon, "actor-empty");
    assert.strictEqual(root.visible, false);
    const [child] = root.children!;
    assert.deepEqual([child.label, child.icon], ["Lamp", "actor-empty"]);
    assert.deepEqual(child.badges, [{ color: "#ff0000", title: "Peer" }]);
    assert.deepEqual(
      child.children?.map(({ id, label, icon, renamable }) => [id, label, icon, renamable]),
      [
        [HierarchyRows.componentRowId("light"), "Directional light", "actor-light", false],
        [HierarchyRows.componentRowId("gone"), "Unknown", "actor-empty", false],
        [child.children![2].id, "Bulb", "actor-empty", true]
      ]
    );
    assert.ok(child.children![1].warning);
    assert.deepEqual(
      rows.componentRow(HierarchyRows.componentRowId("light")),
      { ownerId: childId, componentId: "light" }
    );
  });

  test("numbers the components of one actor that share a summary", () => {
    const document = new SceneDocument();
    const box = { shape: { type: "box" } };
    document.addActor({
      name: "Crate",
      components: [
        { id: "body-a", type: "RigidBody", data: { colliders: [box] }, assets: {} },
        { id: "light-a", type: "Light", data: { kind: "point" }, assets: {} },
        { id: "body-b", type: "RigidBody", data: { colliders: [box] }, assets: {} },
        { id: "light-b", type: "Light", data: { kind: "point" }, assets: {} },
        { id: "spot", type: "Light", data: { kind: "spot" }, assets: {} }
      ]
    });
    document.addActor({
      name: "Lamp",
      components: [{ id: "light-c", type: "Light", data: { kind: "point" }, assets: {} }]
    });

    const [crate, lamp] = readRows(document.tree, kNoAnchors).roots;

    assert.deepEqual(
      crate.children?.map(({ label, detail }) => [label, detail]),
      [
        ["Dynamic body", "Box #1"],
        ["Point light", "#1"],
        ["Dynamic body", "Box #2"],
        ["Point light", "#2"],
        ["Spot light", undefined]
      ]
    );
    assert.deepEqual(
      lamp.children?.map(({ label, detail }) => [label, detail]),
      [["Point light", undefined]]
    );
  });

  test("warns on a component whose asset is gone or of another kind than its slot", () => {
    const document = new SceneDocument();
    document.addActor({
      name: "Sign",
      components: [
        { id: "kept", type: "Text", data: {}, assets: { font: { id: "serif", kind: "font" } } },
        { id: "deleted", type: "Text", data: {}, assets: { font: { id: "gone", kind: "font" } } },
        { id: "swapped", type: "Text", data: {}, assets: { font: { id: "serif", kind: "texture" } } }
      ]
    });

    const [sign] = readRows(document.tree, kNoAnchors, {
      loadable: { canLoad: ({ id }) => id.value === "serif" }
    }).roots;

    assert.deepEqual(
      sign.children?.map(({ warning }) => warning),
      [
        undefined,
        "Its \"font\" asset is gone or of another kind. The game skips this component.",
        "Its \"font\" asset is gone or of another kind. The game skips this component."
      ]
    );
  });

  test("marks a prefab instance with the prefab icon", () => {
    const document = new SceneDocument();
    document.addActor({ name: "House", prefab: { id: "house", kind: "scene" } });

    const [row] = readRows(document.tree, kNoAnchors).roots;

    assert.strictEqual(row.icon, PREFAB_ICON);
  });

  test("refuses a drop inside a prefab instance but keeps a drop beside it", () => {
    const document = new SceneDocument();
    const houseId = document.addActor({ name: "House", prefab: { id: "house", kind: "scene" } })!;
    const crateId = document.addActor({ name: "Crate" })!;

    const rows = readRows(document.tree, kNoAnchors);

    assert.strictEqual(rows.accepts({ movedIds: [crateId], targetId: houseId, where: "inside" }), false);
    assert.strictEqual(rows.accepts({ movedIds: [crateId], targetId: houseId, where: "above" }), true);
  });

  test("lists the expanded actors under their instance and refuses any drop onto or out of them", () => {
    const document = new SceneDocument();
    const houseId = document.addActor({ name: "House", prefab: { id: "house", kind: "scene" } })!;
    const crateId = document.addActor({ name: "Crate" })!;
    const doorId = `${houseId}/door`;
    const knobId = `${houseId}/door/knob`;
    const expanded = new Map([[houseId, [
      { ...actorFile(doorId, houseId, "Front door"), prefab: { id: "door", kind: "scene" } },
      actorFile(knobId, doorId, "Knob")
    ]]]);

    const rows = readRows(document.tree, {
      ...kNoAnchors,
      expandedActors: (instanceId) => (expanded.get(instanceId) ?? []).values()
    });

    const [house] = rows.roots;
    const [door] = house.children!;
    assert.deepEqual(
      [door.id, door.label, door.icon, door.renamable],
      [doorId, "Front door", PREFAB_ICON, true]
    );
    assert.deepEqual(door.children?.map(({ id }) => id), [knobId]);
    assert.strictEqual(rows.isInner(knobId), true);
    assert.strictEqual(rows.isInner(houseId), false);
    assert.strictEqual(rows.accepts({ movedIds: [crateId], targetId: doorId, where: "above" }), false);
    assert.strictEqual(rows.accepts({ movedIds: [knobId], targetId: crateId, where: "inside" }), false);
    assert.deepEqual([...rows.ancestorIds(knobId)], [doorId, houseId]);
  });
});

function actorFile(
  id: string,
  parentId: string,
  name: string
): Systems.SceneActorFile {
  return {
    id,
    name,
    parentId,
    visible: true,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    },
    components: []
  };
}

describe("HierarchyRows components", () => {
  test("turns a drop beside a sibling component into a reorder of that actor's components", () => {
    const { rows } = litScene();
    const light = HierarchyRows.componentRowId("light");
    const camera = HierarchyRows.componentRowId("camera");

    assert.deepEqual(
      rows.drop({ movedIds: [light], targetId: camera, where: "below" }),
      { kind: "component", move: { id: "light" } }
    );
    assert.deepEqual(
      rows.drop({ movedIds: [camera], targetId: light, where: "above" }),
      { kind: "component", move: { id: "camera", beforeId: "light" } }
    );
    assert.deepEqual(
      rows.drop({ movedIds: [light], targetId: kBodyRow, where: "below" }),
      { kind: "component", move: { id: "light", beforeId: "camera" } }
    );
  });

  test("moves nothing when a component drops back beside itself", () => {
    const { rows } = litScene();
    const light = HierarchyRows.componentRowId("light");

    assert.strictEqual(rows.drop({ movedIds: [light], targetId: kBodyRow, where: "above" }), null);
    assert.strictEqual(rows.drop({ movedIds: [kBodyRow], targetId: light, where: "below" }), null);
    assert.strictEqual(rows.drop({ movedIds: [kCameraRow], targetId: kBodyRow, where: "below" }), null);
    assert.strictEqual(rows.drop({ movedIds: [light], targetId: light, where: "above" }), null);
  });

  test("refuses a component dropped inside a row, onto another actor's component or onto an actor", () => {
    const { rows, lampId, bulbId } = litScene();
    const light = HierarchyRows.componentRowId("light");
    const mesh = HierarchyRows.componentRowId("mesh");

    assert.strictEqual(rows.accepts({ movedIds: [light], targetId: kCameraRow, where: "inside" }), false);
    assert.strictEqual(rows.accepts({ movedIds: [light], targetId: mesh, where: "above" }), false);
    assert.strictEqual(rows.accepts({ movedIds: [light], targetId: bulbId, where: "inside" }), false);
    assert.strictEqual(rows.accepts({ movedIds: [light, lampId], targetId: lampId, where: "above" }), false);
  });

  test("refuses an actor dropped beside or inside a component row", () => {
    const { rows, bulbId } = litScene();
    const light = HierarchyRows.componentRowId("light");

    for (const where of ["above", "inside", "below"] as const) {
      assert.strictEqual(rows.accepts({ movedIds: [bulbId], targetId: light, where }), false);
    }
  });

  test("lists every row that has children as a branch", () => {
    const { rows, lampId, bulbId } = litScene();

    assert.deepEqual(
      new Set(rows.branchIds()),
      new Set([lampId, bulbId])
    );
  });
});
