// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/index.ts";
import { TextRenderer } from "../../../src/components/renderers/text/TextRenderer.ts";
import { FontAssetType } from "../../../src/assets/font.ts";
import { SceneManager } from "../../../src/systems/scene/SceneManager.ts";

describe("Components.Renderers.TextRenderer", () => {
  test("should leave meshes it does not own on the actor", () => {
    const world = { sceneManager: new SceneManager() };
    const actor = new Actor(world as any, { name: "label" });
    const foreignMesh = new THREE.Mesh(new THREE.BoxGeometry());
    actor.addChildren(foreignMesh);

    const renderer = actor.addComponentAndGet(TextRenderer, {
      asset: new AssetReference("font", FontAssetType)
    });
    const textMesh = new THREE.Mesh(new THREE.BoxGeometry());
    Object.defineProperty(renderer.text, "mesh", { get: () => textMesh });

    renderer.updateMesh();
    renderer.updateMesh();

    assert.deepEqual(actor.object3D.children, [foreignMesh, textMesh]);
  });
});
