// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ActorComponent } from "./ActorComponent.js";
import { Actor } from "./Actor.js";

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

export class Behavior<
  T extends BehaviorProperties = Record<string, BehaviorPropertiesValue>
> extends ActorComponent {
  #properties: T = Object.create(null);

  constructor(
    actor: Actor
  ) {
    super({
      actor,
      typeName: "ScriptBehavior"
    });

    if (this.constructor.name in this.actor.behaviors) {
      this.actor.behaviors[this.constructor.name].push(this);
    }
    else {
      this.actor.behaviors[this.constructor.name] = [this];
    }
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

  override destroy(): void {
    if (this.pendingForDestruction) {
      return;
    }

    if (this.constructor.name in this.actor.behaviors) {
      const behaviorList = this.actor.behaviors[this.constructor.name];
      behaviorList.splice(behaviorList.indexOf(this), 1);
      if (behaviorList.length === 0) {
        delete this.actor.behaviors[this.constructor.name];
      }
    }

    super.destroy();
  }
}
