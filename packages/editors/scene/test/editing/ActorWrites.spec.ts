// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ComponentChange,
  SceneDocument
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type { SceneCapability } from "../../src/access/SceneAccess.ts";
import { ActorWrites } from "../../src/editing/ActorWrites.ts";
import { sceneAccess } from "../helpers/sceneAccess.ts";

interface WriteCase {
  capability: SceneCapability;
  edit: string;
  write: (writes: ActorWrites, ids: SceneIds) => boolean;
}

interface SceneIds {
  actorId: string;
  innerId: string;
}

// CONSTANTS
const kCases: WriteCase[] = [
  {
    capability: "hierarchy",
    edit: "renaming an actor",
    write: (writes, { actorId }) => writes.rename(actorId, "Gate")
  },
  {
    capability: "transforms",
    edit: "moving an actor",
    write: (writes, { actorId }) => writes.transform(actorId, {
      position: { x: 2, y: 0, z: 0 }
    })
  },
  {
    capability: "components",
    edit: "changing a component",
    write: (writes) => writes.changeComponent(
      "lever",
      new ComponentChange({ data: { pulled: true } })
    )
  },
  {
    capability: "instances",
    edit: "renaming an actor of an instance",
    write: (writes, { innerId }) => writes.rename(innerId, "Front door")
  }
];

function createScene() {
  const document = new SceneDocument();
  const actorId = document.addActor({
    name: "Door",
    components: [{ id: "lever", type: "Lever", data: {}, assets: {} }]
  })!;
  const instanceId = document.addActor({
    name: "House",
    prefab: { id: "house", kind: "scene" }
  })!;
  const access = sceneAccess();
  const actions: string[] = [];
  document.on("change", ({ command }) => actions.push(command.action));

  return {
    access,
    actions,
    writes: new ActorWrites(document, access),
    ids: {
      actorId,
      innerId: `${instanceId}/door`
    }
  };
}

describe("ActorWrites", () => {
  for (const { capability, edit, write } of kCases) {
    test(`refuses ${edit} without "${capability}" and allows it with only that capability`, () => {
      const { access, actions, writes, ids } = createScene();

      access.withhold(capability);
      assert.strictEqual(write(writes, ids), false);
      assert.deepEqual(actions, []);

      access.grant(capability);
      assert.strictEqual(write(writes, ids), true);
      assert.strictEqual(actions.length, 1);
    });
  }

  test("refuses a rename and a move written together when only the hierarchy is granted", () => {
    const { access, actions, writes, ids } = createScene();
    access.grant("hierarchy");

    assert.strictEqual(writes.writeActor(ids.actorId, {
      name: "Gate",
      transform: { position: { x: 2, y: 0, z: 0 } }
    }), false);
    assert.deepEqual(actions, []);
  });
});
