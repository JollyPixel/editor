// Import Internal Dependencies
import type { Actor } from "../../actor/Actor.ts";
import {
  INPUT_LISTENER_TARGETS,
  getBehaviorMetadata,
  type BehaviorMetadata
} from "./BehaviorDecorators.ts";
import { bindScenePropertyValue } from "./ScenePropertyValue.ts";

export interface InitializableBehavior {
  actor: Actor<any>;
  addTeardown(teardown: () => void): void;
}

type BehaviorRecord = InitializableBehavior & Record<PropertyKey, any>;

export class BehaviorInitializer {
  #behavior: BehaviorRecord;
  #metadata: BehaviorMetadata;

  static for(
    behavior: InitializableBehavior
  ): BehaviorInitializer | null {
    const proto = Object.getPrototypeOf(behavior);
    const metadata = getBehaviorMetadata(proto);
    if (!metadata) {
      return null;
    }

    return new BehaviorInitializer(behavior, metadata);
  }

  constructor(
    behavior: InitializableBehavior,
    metadata: BehaviorMetadata
  ) {
    this.#behavior = behavior as BehaviorRecord;
    this.#metadata = metadata;
  }

  get behaviorName(): string {
    return this.#behavior.constructor.name;
  }

  load(): void {
    this.#resolveProperties();
    this.#resolveActorComponents();
    this.#resolveInputListeners();
  }

  #warnMissing(
    kind: string,
    name: PropertyKey
  ): void {
    this.#behavior.actor.world.logger.warn(`Behavior ${kind} not found`, {
      behavior: this.behaviorName,
      name: String(name)
    });
  }

  #resolveInputListeners(): void {
    const { input } = this.#behavior.actor.world;

    for (const { device, event, methodName } of this.#metadata.inputListeners) {
      if (!(methodName in this.#behavior)) {
        this.#warnMissing("method", methodName);
        continue;
      }

      const target = INPUT_LISTENER_TARGETS[device](input);
      const listener = this.#behavior[methodName].bind(this.#behavior);

      target.on(event, listener);
      this.#behavior.addTeardown(() => target.off(event, listener));
    }
  }

  #resolveProperties(): void {
    const scope = {
      findActor: (persistentId: string) => this.#resolveActor(persistentId)
    };

    for (const [propertyName, { type }] of this.#metadata.properties) {
      this.#behavior[propertyName] = bindScenePropertyValue(
        type,
        this.#behavior[propertyName],
        scope
      );
    }
  }

  #resolveActor(
    persistentId: string
  ): Actor<any> | null {
    const actor = this.#behavior.actor.world.sceneManager.actors.find(
      persistentId
    );
    if (actor === null || actor.pendingForDestruction) {
      this.#warnMissing("actor", persistentId);

      return null;
    }

    return actor;
  }

  #resolveActorComponents(): void {
    for (const [componentName, ComponentClass] of this.#metadata.components) {
      if (!(componentName in this.#behavior)) {
        this.#warnMissing("component", componentName);
        continue;
      }

      this.#behavior[componentName] = this.#behavior.actor.components.find(
        ComponentClass
      ) ?? undefined;
    }
  }
}
