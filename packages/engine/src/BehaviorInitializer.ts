// Import Third-party Dependencies
import * as THREE from "three";
import "reflect-metadata";

// Import Internal Dependencies
import {
  Input,
  type InputListenerMetadata
} from "./controls/Input.class.js";
import { Behavior } from "./Behavior.js";
import {
  getBehaviorMetadata,
  type ScenePropertyType,
  type BehaviorMetadata
} from "./BehaviorDecorators.js";
import { type ConsoleAdapter } from "./adapters/console.js";

// CONSTANTS
const kDefaultValues: Record<ScenePropertyType, unknown> = {
  string: "",
  "string[]": [],
  number: 0,
  "number[]": [],
  boolean: false,
  "boolean[]": [],
  Vector2: new THREE.Vector2(0, 0),
  Vector3: new THREE.Vector3(0, 0, 0)
};

export interface BehaviorInitializerOptions {
  consoleAdapter?: ConsoleAdapter;
}

export class BehaviorInitializer {
  #behavior: Behavior;
  #metadata: BehaviorMetadata;
  #console: ConsoleAdapter;

  static for(
    behavior: Behavior
  ): BehaviorInitializer | null {
    const proto = Object.getPrototypeOf(behavior);
    const metadata = getBehaviorMetadata(proto);

    if (!metadata) {
      return null;
    }

    return new BehaviorInitializer(behavior, metadata);
  }

  constructor(
    behavior: Behavior,
    metadata: BehaviorMetadata,
    options: BehaviorInitializerOptions = {}
  ) {
    const { consoleAdapter = console } = options;

    this.#behavior = behavior;
    this.#metadata = metadata;
    this.#console = consoleAdapter;
  }

  get behaviorName(): string {
    return this.#behavior.constructor.name;
  }

  load(): void {
    this.#resolveProperties();
    this.#resolveActorComponents();
    this.#resolveInputListeners();
  }

  #resolveInputListeners(): void {
    const { input } = this.#behavior.actor.gameInstance;

    const metadata = Reflect.getMetadata(
      Input.Metadata,
      this.#behavior
    ) as InputListenerMetadata[] | undefined ?? [];

    for (const { type, methodName } of metadata) {
      if (!(methodName in this.#behavior)) {
        this.#console.warn(
          `[BehaviorInitializer] Class method '${methodName}' not found in ${this.behaviorName}`
        );
        continue;
      }

      const [targetName, eventName] = type.split(".") as [string, any];
      input[targetName].hooks.on(
        eventName,
        this.#behavior[methodName].bind(this.#behavior)
      );
    }
  }

  #resolveProperties(): void {
    for (const [propertyName, type] of this.#metadata.properties) {
      const currentValue = this.#behavior[propertyName];
      const defaultValue = this.#getDefaultValue(type);
      const finalValue = currentValue ?? defaultValue;

      this.#behavior[propertyName] = finalValue;
      this.#behavior.setProperty(propertyName as any, finalValue);
    }
  }

  #resolveActorComponents(): void {
    for (const [componentName, ComponentClass] of this.#metadata.components) {
      if (!(componentName in this.#behavior)) {
        this.#console.warn(
          `[BehaviorInitializer] Component '${String(componentName)}' not found in ${this.behaviorName}`
        );

        continue;
      }

      const component = this.#behavior.actor.components.find(
        (component) => component.constructor.name === ComponentClass.name
      );
      this.#behavior[componentName] = component ?? undefined;
    }
  }

  #getDefaultValue(
    type: ScenePropertyType
  ): unknown {
    const value = kDefaultValues[type];

    if (
      value instanceof THREE.Vector2 ||
      value instanceof THREE.Vector3
    ) {
      return value.clone();
    }
    if (Array.isArray(value)) {
      return [...value];
    }

    return value;
  }
}

