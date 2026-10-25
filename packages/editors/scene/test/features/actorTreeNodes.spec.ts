// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { actorTreeNodes } from "../../src/features/hierarchy/actorTreeNodes.ts";

describe("actorTreeNodes", () => {
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

    const [root] = actorTreeNodes(document.tree, new Map([[childId, [peer]]]));

    assert.strictEqual(root.icon, "actor-empty");
    assert.strictEqual(root.visible, false);
    assert.strictEqual(root.children?.length, 1);
    const [child] = root.children!;
    assert.strictEqual(child.label, "Lamp");
    assert.strictEqual(child.icon, "actor-light");
    assert.deepEqual(child.badges, [{ color: "#ff0000", title: "Peer" }]);
  });
});
