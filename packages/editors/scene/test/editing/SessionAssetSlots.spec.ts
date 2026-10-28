// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import { DependencyIndex } from "@jolly-pixel/asset-server/client";
import type { AssetPickOptions, EditorSession } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import { SessionAssetSlots } from "../../src/editing/SessionAssetSlots.ts";

function scene(
  id: string
): AssetReferenceData {
  return {
    id,
    kind: "scene"
  };
}

describe("SessionAssetSlots.pickScene", () => {
  test("offers only the scenes that do not include the open scene", async() => {
    const dependencies = new DependencyIndex();
    dependencies.set("house", [scene("room")]);
    dependencies.set("room", [scene("level")]);
    dependencies.set("tree", [{ id: "map", kind: "voxelmap" }]);
    const picks: AssetPickOptions[] = [];
    const session = {
      catalog: { dependencies },
      pickAsset: (options: AssetPickOptions) => {
        picks.push(options);

        return Promise.resolve(scene("tree"));
      }
    } as unknown as Pick<EditorSession, "catalog" | "pickAsset">;
    const slots = new SessionAssetSlots({
      session,
      sceneId: "level",
      descriptors: [],
      open: null
    });

    const picked = await slots.pickScene();

    const [{ kinds, accepts }] = picks;
    assert.deepEqual(picked, scene("tree"));
    assert.deepEqual([...kinds].map(({ kind }) => kind), ["scene"]);
    assert.deepEqual(
      ["level", "house", "room", "tree", "empty"].filter((id) => accepts!(scene(id))),
      ["tree", "empty"]
    );
  });
});
