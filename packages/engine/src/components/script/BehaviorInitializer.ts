// Import Internal Dependencies
import type { Actor } from "../../actor/Actor.ts";
import {
  getBehaviorMetadata,
  type BehaviorMetadata
} from "./BehaviorDecorators.ts";
import { createScenePropertyDefault } from "./ScenePropertyValue.ts";

export interface InitializableBehavior {
  actor: Actor<any>;
  addTeardown(teardown: () => void): void;
}

type BehaviorRecord = InitializableBehavior & Record<PropertyKey, any>;

interface InputEventTarget {
  on(eventName: string, listener: (...args: any[]) => void): unknown;
  off(eventName: string, listener: (...args: any[]) => void): unknown;
}

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

    for (const { type, methodName } of this.#metadata.inputListeners) {
      if (!(methodName in this.#behavior)) {
        this.#warnMissing("method", methodName);
        continue;
      }

      const [targetName, eventName] = type.split(".");
      const target: InputEventTarget = targetName === "input" ?
        input :
        (input as unknown as Record<string, InputEventTarget>)[targetName];
      const listener = this.#behavior[methodName].bind(this.#behavior);

      target.on(eventName, listener);
      this.#behavior.addTeardown(() => target.off(eventName, listener));
    }
  }

  #resolveProperties(): void {
    for (const [propertyName, { type }] of this.#metadata.properties) {
      this.#behavior[propertyName] ??= createScenePropertyDefault(type);
    }
  }

  #resolveActorComponents(): void {
    for (const [componentName, ComponentClass] of this.#metadata.components) {
      if (!(componentName in this.#behavior)) {
        this.#warnMissing("component", componentName);
        continue;
      }

      this.#behavior[componentName] = this.#behavior.actor.components.find(
        (component) => component instanceof ComponentClass
      );
    }
  }
}
