// Import Internal Dependencies
import type { Actor } from "../../../core/actor/Actor.ts";
import type { Component } from "../../../core/components/types.ts";
import type {
  ComponentDefinition
} from "../../../core/systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../../core/systems/scene/file/SceneFile.ts";
import { AudioListenerComponent } from "./AudioListenerComponent.ts";

export class AudioListenerDefinition implements ComponentDefinition<
  JSONObject,
  AudioListenerComponent<any>
> {
  readonly type = "AudioListener";

  parse(): JSONObject {
    return {};
  }

  create(
    actor: Actor<any>
  ): AudioListenerComponent<any> {
    return actor.addComponentAndGet(AudioListenerComponent);
  }

  owns(
    component: Component
  ): component is AudioListenerComponent<any> {
    return component instanceof AudioListenerComponent;
  }
}
