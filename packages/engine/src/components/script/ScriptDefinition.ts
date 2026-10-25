// Import Internal Dependencies
import type { Actor } from "../../actor/Actor.ts";
import {
  ComponentData,
  isJSONObject
} from "../../systems/scene/file/ComponentData.ts";
import type {
  ComponentContext,
  ComponentDefinition
} from "../../systems/scene/file/ComponentDefinition.ts";
import type { JSONObject } from "../../systems/scene/file/SceneFile.ts";
import type {
  Behavior,
  BehaviorOptions
} from "./Behavior.ts";
import { getBehaviorMetadata } from "./BehaviorDecorators.ts";
import { parseScenePropertyValue } from "./ScenePropertyValue.ts";

export type BehaviorConstructor = new (
  actor: Actor<any>,
  options?: BehaviorOptions
) => Behavior<any, any>;

export interface ScriptData {
  behavior: string;
  properties: Readonly<JSONObject>;
}

export class ScriptDefinition implements ComponentDefinition<
  ScriptData,
  Behavior<any, any>
> {
  readonly type = "Script";

  #behaviors: ReadonlyMap<string, BehaviorConstructor>;

  constructor(
    behaviors: Readonly<Record<string, BehaviorConstructor>>
  ) {
    this.#behaviors = new Map(Object.entries(behaviors));
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
  ): Behavior<any, any> | null {
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
