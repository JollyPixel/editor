// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../../../src/core/actor/Actor.ts";
import {
  Behavior,
  SceneProperty,
  SCRIPT_ASSET_TYPES,
  ScriptDefinition,
  Sound,
  SoundAssetType,
  scriptPropertySlot
} from "../../../src/index.ts";
import { ComponentAssets } from "../../../src/core/systems/scene/file/definitions/ComponentDefinition.ts";
import {
  ComponentDefinitions
} from "../../../src/core/systems/scene/file/definitions/ComponentDefinitions.ts";
import { fakeAudioBuffer } from "../../helpers/audio/FakeAudioContext.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";

class Jukebox extends Behavior {
  theme: Sound | null = null;
  hit: Sound | null = null;
  scratch: Sound | null = null;
}
SceneProperty({ type: "Sound" })(Jukebox.prototype, "theme");
SceneProperty({ type: "Sound" })(Jukebox.prototype, "hit");
SceneProperty({ type: "Sound" })(Jukebox.prototype, "scratch");

describe("Components.ScriptDefinition asset properties", () => {
  test("hands a Sound property the sound set in its slot, and null otherwise", () => {
    const { world } = createSceneSetup();
    const actor = new Actor(world as any, { name: "jukebox" });
    const definition = new ScriptDefinition({ Jukebox }, {
      assetTypes: SCRIPT_ASSET_TYPES
    });
    const theme = new Sound(fakeAudioBuffer());

    const jukebox = definition.create(actor, definition.parse({ behavior: "Jukebox" }), {
      mode: "play",
      assets: new ComponentAssets(definition.assets, {
        [scriptPropertySlot("theme")]: { id: "theme", kind: "sound" },
        [scriptPropertySlot("hit")]: { id: "crate", kind: "texture" }
      }, {
        resolve: <TValue>() => theme as TValue
      })
    }) as Jukebox;
    actor.awake();

    assert.strictEqual(jukebox.theme, theme);
    assert.strictEqual(jukebox.hit, null);
    assert.strictEqual(jukebox.scratch, null);
  });

  test("lists the sounds of Sound properties among the assets a scene loads", () => {
    const components = new ComponentDefinitions().register(
      new ScriptDefinition({}, { assetTypes: SCRIPT_ASSET_TYPES })
    );

    const references = [...components.assets({
      actors: [{
        id: "a1",
        name: "jukebox",
        components: [{
          id: "c1",
          type: "Script",
          data: { behavior: "Jukebox" },
          assets: {
            [scriptPropertySlot("theme")]: { id: "theme", kind: "sound" },
            [scriptPropertySlot("hit")]: { id: "crate", kind: "texture" },
            stray: { id: "other", kind: "sound" }
          }
        }]
      } as any]
    })];

    assert.equal(references.length, 1);
    assert.ok(references[0].equals(new AssetReference("theme", SoundAssetType)));
  });
});
