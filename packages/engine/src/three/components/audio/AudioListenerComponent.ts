// Import Internal Dependencies
import { ActorComponent } from "../../../core/actor/ActorComponent.ts";
import type { Actor } from "../../../core/actor/Actor.ts";
import type { WorldDefaultContext } from "../../../core/systems/World.ts";

export class AudioListenerComponent<
  TContext = WorldDefaultContext
> extends ActorComponent<TContext> {
  constructor(
    actor: Actor<TContext>
  ) {
    super({
      actor,
      typeName: "AudioListener"
    });

    const { listener } = actor.world.audio;
    actor.node.object3D.add(listener);
    this.addTeardown(() => {
      if (listener.parent === actor.node.object3D) {
        listener.removeFromParent();
      }
    });
  }
}
