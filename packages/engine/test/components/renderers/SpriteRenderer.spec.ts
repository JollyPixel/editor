// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/index.ts";
import { TEXTURE_ASSET } from "../../../src/assets/texture.ts";
import { SpriteRenderer } from "../../../src/components/renderers/sprite/SpriteRenderer.ts";
import { SceneManager } from "../../../src/systems/scene/SceneManager.ts";

describe("Components.Renderers.SpriteRenderer", () => {
  test("should request updates only while an animation plays", () => {
    const world = { sceneManager: new SceneManager() };
    const actor = new Actor(world as any, { name: "sprite" });
    const renderer = actor.addComponentAndGet(SpriteRenderer, {
      texture: new AssetReference("sprite", TEXTURE_ASSET),
      tileHorizontal: 3,
      tileVertical: 1,
      animations: { walk: [0, 1, 2] }
    });
    const idle = renderer.needUpdate;

    renderer.animation.play("walk", { duration: 0.3 });
    const playing = renderer.needUpdate;
    renderer.update(0.1);
    const midway = renderer.needUpdate;
    renderer.update(0.1);

    assert.deepEqual(
      [idle, playing, midway, renderer.needUpdate],
      [false, true, true, false]
    );
    assert.strictEqual(renderer.frameIndex, 2);
  });
});
