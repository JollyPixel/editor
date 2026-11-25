// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { readRows } from "../helpers/hierarchy/hierarchyRows.ts";
import { sceneAccess } from "../helpers/sceneAccess.ts";

function houseWithDoor() {
  const document = new SceneDocument();
  const houseId = document.addActor({ name: "House", prefab: { id: "house", kind: "scene" } })!;
  const door: Systems.SceneActorFile = {
    id: `${houseId}/door`,
    name: "Door",
    parentId: houseId,
    visible: true,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    },
    components: []
  };
  const access = sceneAccess();

  return {
    access,
    renamable(): (boolean | undefined)[] {
      const [house] = readRows(document.tree, {
        anchors: () => [].values(),
        expandedActors: (instanceId) => (instanceId === houseId ? [door] : []).values()
      }, { access }).roots;

      return [house.renamable, house.children?.[0].renamable];
    }
  };
}

describe("HierarchyRows access", () => {
  test("lets an actor be renamed only with the capability its rename writes", () => {
    const { access, renamable } = houseWithDoor();

    access.withhold("instances");
    assert.deepEqual(renamable(), [true, false]);

    access.withhold("hierarchy");
    assert.deepEqual(renamable(), [false, true]);
  });
});
