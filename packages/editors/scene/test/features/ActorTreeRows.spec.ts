// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  ActorTreeRows,
  PREFAB_ICON
} from "../../src/features/hierarchy/ActorTreeRows.ts";
import { createSceneComponents } from "../helpers/sceneComponents.ts";

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
      createSceneComponents()
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

    const [row] = ActorTreeRows.read(document.tree, new Map(), createSceneComponents()).roots;

    assert.strictEqual(row.icon, PREFAB_ICON);
  });
});
