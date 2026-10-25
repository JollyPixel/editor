// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type {
  WorldDefaultContext
} from "../../systems/World.ts";
import {
  type Actor,
  ActorComponent
} from "../../actor/index.ts";
import { BehaviorInitializer } from "./BehaviorInitializer.ts";

export type BehaviorPropertiesValue =
  | string
  | string[]
  | number
  | number[]
  | boolean
  | boolean[]
  | THREE.Vector2
  | THREE.Vector3;
export type BehaviorProperties = Record<string, BehaviorPropertiesValue>;

export interface BehaviorOptions {
  /**
   * Field values assigned once field initializers have run, before the
   * `@SceneProperty` defaults resolve.
   */
  properties?: Readonly<Record<string, unknown>>;
}

export class Behavior<
  T extends BehaviorProperties = Record<string, BehaviorPropertiesValue>,
  TContext = WorldDefaultContext
> extends ActorComponent<TContext> {
  #properties: T = Object.create(null);
  #initialProperties: Readonly<Record<string, unknown>> | null;

  constructor(
    actor: Actor<TContext>,
    options: BehaviorOptions = {}
  ) {
    super({
      actor,
      typeName: "ScriptBehavior"
    });
    this.#initialProperties = options.properties ?? null;

    const { behaviors } = this.actor;
    const name = this.constructor.name;
    (behaviors[name] ??= []).push(this);

    this.addTeardown(() => {
      const behaviorList = behaviors[name] ?? [];
      behaviorList.splice(behaviorList.indexOf(this), 1);
      if (behaviorList.length === 0) {
        delete behaviors[name];
      }
    });
  }

  bind(): void {
    if (this.#initialProperties !== null) {
      Object.assign(this, this.#initialProperties);
      this.#initialProperties = null;
    }
    BehaviorInitializer.for(this)?.load();
  }

  setProperty<K extends keyof T = keyof T>(
    propertyName: K,
    value: T[K]
  ): void {
    this.#properties[propertyName] = value;
  }

  getProperty<K extends keyof T = keyof T>(
    propertyName: K,
    defaultValue: T[K]
  ): T[K] {
    return this.#properties[propertyName] ?? defaultValue;
  }

  mergeProperties(
    defaultProperties: Partial<T> = Object.create(null)
  ) {
    Object.assign(this, defaultProperties, this.#properties);
  }
}
