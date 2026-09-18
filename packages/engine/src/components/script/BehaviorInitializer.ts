// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { Actor } from "../../actor/Actor.ts";
import {
  getBehaviorMetadata,
  type ScenePropertyType,
  type BehaviorMetadata
} from "./BehaviorDecorators.ts";
import type { ConsoleAdapter } from "../../adapters/console.ts";

// CONSTANTS
const kDefaultValues: Record<ScenePropertyType, unknown> = {
  string: "",
  "string[]": [],
  number: 0,
  "number[]": [],
  boolean: false,
  "boolean[]": [],
  Vector2: new THREE.Vector2(0, 0),
  Vector3: new THREE.Vector3(0, 0, 0),
  Vector4: new THREE.Vector4(0, 0, 0, 0),
  Color: new THREE.Color(0, 0, 0)
};

export interface InitializableBehavior {
  actor: Actor<any>;
  addTeardown(teardown: () => void): void;
  setProperty(propertyName: string, value: any): void;
}

type BehaviorRecord = InitializableBehavior & Record<PropertyKey, any>;

interface InputEventTarget {
  on(eventName: string, listener: (...args: any[]) => void): unknown;
  off(eventName: string, listener: (...args: any[]) => void): unknown;
}

export interface BehaviorInitializerOptions {
  consoleAdapter?: ConsoleAdapter;
}

export class BehaviorInitializer {
  #behavior: BehaviorRecord;
  #metadata: BehaviorMetadata;
  #console: ConsoleAdapter;

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
    metadata: BehaviorMetadata,
    options: BehaviorInitializerOptions = {}
  ) {
    const { consoleAdapter = console } = options;

    this.#behavior = behavior as BehaviorRecord;
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
    const { input } = this.#behavior.actor.world;

    for (const { type, methodName } of this.#metadata.inputListeners) {
      if (!(methodName in this.#behavior)) {
        this.#console.warn(
          `[BehaviorInitializer] Class method '${String(methodName)}' not found in ${this.behaviorName}`
        );
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
      const finalValue = this.#behavior[propertyName] ?? defaultValueOf(type);

      this.#behavior[propertyName] = finalValue;
      this.#behavior.setProperty(propertyName as string, finalValue);
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

      this.#behavior[componentName] = this.#behavior.actor.components.find(
        (component) => component instanceof ComponentClass
      );
    }
  }
}

function defaultValueOf(
  type: ScenePropertyType
): unknown {
  const value = kDefaultValues[type];

  if (
    value instanceof THREE.Vector2 ||
    value instanceof THREE.Vector3 ||
    value instanceof THREE.Vector4 ||
    value instanceof THREE.Color
  ) {
    return value.clone();
  }
  if (Array.isArray(value)) {
    return [...value];
  }

  return value;
}
