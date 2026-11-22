// Import Third-party Dependencies
import {
  ActorComponent,
  type Actor,
  type Systems
} from "@jolly-pixel/ecs";

export class AudioListenerComponent<
  TContext = Systems.WorldDefaultContext
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
