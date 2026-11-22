// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Actor, Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { Sound } from "../../../src/audio/Sound.ts";
import { AudioListenerComponent } from "../../../src/components/audio/AudioListenerComponent.ts";
import { AudioSourceDefinition } from "../../../src/components/audio/AudioSourceDefinition.ts";
import {
  fakeAudioBuffer,
  installFakeAudioContext
} from "../../helpers/audio/FakeAudioContext.ts";
import { createThreeSceneSetup } from "../../helpers/scene/threeSceneSetup.ts";

function createSource(
  mode: Systems.SceneMode
) {
  installFakeAudioContext();
  const { world } = createThreeSceneSetup();
  const actor = new Actor(world as any, { name: "speaker" });
  const definition = new AudioSourceDefinition();
  const sound = new Sound(fakeAudioBuffer(), { volume: 0.5 });
  const component = definition.create(
    actor,
    definition.parse({ playOnStart: true, volume: 0.5 }),
    {
      mode,
      assets: new Systems.ComponentAssets(
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
    const { world, audio } = createThreeSceneSetup();
    const actor = new Actor(world as any, { name: "ears" });

    const component = actor.addComponentAndGet(AudioListenerComponent);
    assert.strictEqual(audio.listener.parent, actor.node.object3D);

    component.destroy();
    assert.strictEqual(audio.listener.parent, null);
  });
});
