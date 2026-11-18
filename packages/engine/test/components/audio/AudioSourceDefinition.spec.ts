// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../../../src/core/actor/Actor.ts";
import {
  ComponentAssets,
  type SceneMode
} from "../../../src/core/systems/scene/file/definitions/ComponentDefinition.ts";
import { Sound } from "../../../src/three/audio/Sound.ts";
import { AudioListenerComponent } from "../../../src/three/components/audio/AudioListenerComponent.ts";
import { AudioSourceDefinition } from "../../../src/three/components/audio/AudioSourceDefinition.ts";
import {
  fakeAudioBuffer,
  installFakeAudioContext
} from "../../helpers/audio/FakeAudioContext.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";

function createSource(
  mode: SceneMode
) {
  installFakeAudioContext();
  const { world } = createSceneSetup();
  const actor = new Actor(world as any, { name: "speaker" });
  const definition = new AudioSourceDefinition();
  const sound = new Sound(fakeAudioBuffer(), { volume: 0.5 });
  const component = definition.create(
    actor,
    definition.parse({ playOnStart: true, volume: 0.5 }),
    {
      mode,
      assets: new ComponentAssets(
        definition.assets,
        { sound: { id: "jump", kind: "sound" } },
        { resolve: <TValue>() => sound as TValue }
      )
    }
  );

  return { actor, component };
}

describe("Components.AudioSourceDefinition", () => {
  test("plays on start from the actor position in play mode", () => {
    const { actor, component } = createSource("play");

    component.start();

    assert.strictEqual(component.instance?.audio.parent, actor.node.object3D);
    assert.strictEqual(component.instance?.volume, 0.25);
  });

  test("never plays on start in edit mode", () => {
    const { component } = createSource("edit");

    component.start();

    assert.strictEqual(component.instance, null);
  });
});

describe("Components.AudioListenerComponent", () => {
  test("hears from its actor until it is destroyed", () => {
    installFakeAudioContext();
    const { world } = createSceneSetup();
    const actor = new Actor(world as any, { name: "ears" });

    const component = actor.addComponentAndGet(AudioListenerComponent);
    assert.strictEqual(world.audio.listener.parent, actor.node.object3D);

    component.destroy();
    assert.strictEqual(world.audio.listener.parent, null);
  });
});
