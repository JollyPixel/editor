// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { Actor } from "../../actor/Actor.ts";
import {
  ComponentData,
  isJSONObject
} from "../../systems/scene/file/definitions/ComponentData.ts";
import type {
  ComponentAssetTypes,
  ComponentContext,
  ComponentDefinition
} from "../../systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../systems/scene/file/SceneFile.ts";
import type { Component } from "../types.ts";
import {
  Behavior,
  type BehaviorOptions
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

export type ScriptModule = Readonly<Record<string, unknown>>;

export type ScriptAssets = {
  script: ScriptModule;
};

export interface ScriptData {
  behavior: string;
  properties: Readonly<JSONObject>;
}

// CONSTANTS
export const SCRIPT_MODULE_ASSET = new AssetType<ScriptModule>("script");

export class ScriptDefinition implements ComponentDefinition<
  ScriptData,
  Behavior<any>,
  ScriptAssets
> {
  readonly type = "Script";
  readonly assets: ComponentAssetTypes<ScriptAssets> = {
    script: SCRIPT_MODULE_ASSET
  };

  #registered: ScriptModule;
  #names = new WeakMap<object, string>();

  constructor(
    behaviors: Readonly<Record<string, BehaviorConstructor>> = {}
  ) {
    this.#registered = { ...behaviors };
    for (const [name, behavior] of Object.entries(behaviors)) {
      this.#names.set(behavior, name);
    }
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
    context: ComponentContext<ScriptAssets>
  ): Behavior<any> | null {
    if (context.mode === "edit") {
      return null;
    }

    const behavior = this.#behavior(
      data.behavior,
      context.assets.resolve("script") ?? this.#registered
    );
    if (behavior === null) {
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

  #behavior(
    name: string,
    module: ScriptModule
  ): BehaviorConstructor | null {
    const exported = Object.hasOwn(module, name) ? module[name] : undefined;
    if (!isBehaviorConstructor(exported)) {
      return null;
    }
    this.#names.set(exported, name);

    return exported;
  }
}

function isBehaviorConstructor(
  value: unknown
): value is BehaviorConstructor {
  return typeof value === "function" &&
    value.prototype instanceof Behavior;
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
