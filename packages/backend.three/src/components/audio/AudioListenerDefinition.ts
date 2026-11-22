// Import Third-party Dependencies
import type {
  Actor,
  Component,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { AudioListenerComponent } from "./AudioListenerComponent.ts";

export class AudioListenerDefinition implements Systems.ComponentDefinition<
  Systems.JSONObject,
  AudioListenerComponent<any>
> {
  readonly type = "AudioListener";

  parse(): Systems.JSONObject {
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
