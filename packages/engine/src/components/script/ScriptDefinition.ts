// Import Internal Dependencies
import type { Actor } from "../../actor/Actor.ts";
import {
  ComponentData,
  isJSONObject
} from "../../systems/scene/file/definitions/ComponentData.ts";
import type {
  ComponentContext,
  ComponentDefinition
} from "../../systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../systems/scene/file/SceneFile.ts";
import type { Component } from "../types.ts";
import type {
  Behavior,
  BehaviorOptions
} from "./Behavior.ts";
import { getBehaviorMetadata } from "./BehaviorDecorators.ts";
import {
  parseScenePropertyValue,
  serializeScenePropertyValue
} from "./ScenePropertyValue.ts";

export type BehaviorConstructor = new (
  actor: Actor<any>,
  options?: BehaviorOptions
) => Behavior<any>;

export interface ScriptData {
  behavior: string;
  properties: Readonly<JSONObject>;
}

export class ScriptDefinition implements ComponentDefinition<
  ScriptData,
  Behavior<any>
> {
  readonly type = "Script";

  #behaviors: ReadonlyMap<string, BehaviorConstructor>;
  #names: ReadonlyMap<unknown, string>;

  constructor(
    behaviors: Readonly<Record<string, BehaviorConstructor>>
  ) {
    this.#behaviors = new Map(Object.entries(behaviors));
    this.#names = new Map(
      Object.entries(behaviors).map(([name, behavior]) => [behavior, name])
    );
  }

  parse(
    data: Readonly<JSONObject>
  ): ScriptData {
    const fields = new ComponentData(data);
    const properties = data.properties;

    return {
      behavior: fields.string("behavior", ""),
      properties: isJSONObject(properties) ? properties : {}
    };
  }

  create(
    actor: Actor<any>,
    data: ScriptData,
    context: ComponentContext
  ): Behavior<any> | null {
    if (context.mode === "edit") {
      return null;
    }

    const behavior = this.#behaviors.get(data.behavior);
    if (behavior === undefined) {
      actor.world.logger.warn("Unregistered behavior skipped", {
        behavior: data.behavior,
        actor: actor.name
      });

      return null;
    }

    return actor.addComponentAndGet(behavior, {
      properties: convertProperties(behavior, data.properties)
    });
  }

  owns(
    component: Component
  ): component is Behavior<any> {
    return this.#names.has(component.constructor);
  }

  capture(
    component: Behavior<any>
  ): JSONObject {
    return {
      behavior: this.#names.get(component.constructor) ?? "",
      properties: captureProperties(component)
    };
  }
}

function captureProperties(
  component: Behavior<any>
): JSONObject {
  const declared = getBehaviorMetadata(
    Object.getPrototypeOf(component)
  )?.properties ?? [];
  const captured: JSONObject = {};

  for (const [name, { type }] of declared) {
    if (typeof name !== "string") {
      continue;
    }

    const value = serializeScenePropertyValue(
      type,
      Reflect.get(component, name)
    );
    if (value !== undefined) {
      captured[name] = value;
    }
  }

  return captured;
}

function convertProperties(
  behavior: BehaviorConstructor,
  properties: Readonly<JSONObject>
): Record<string, unknown> {
  const declared = getBehaviorMetadata(
    behavior.prototype
  )?.properties ?? [];
  const converted: Record<string, unknown> = Object.create(null);

  for (const [name, { type }] of declared) {
    if (
      typeof name !== "string" ||
      !Object.hasOwn(properties, name)
    ) {
      continue;
    }

    const value = parseScenePropertyValue(
      type,
      properties[name]
    );
    if (value !== undefined) {
      converted[name] = value;
    }
  }

  return converted;
}
