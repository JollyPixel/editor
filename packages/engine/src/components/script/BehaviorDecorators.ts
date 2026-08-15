// Import Third-party Dependencies
import "reflect-metadata";
import type { InputListenerType } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type {
  ModelRenderer,
  SpriteRenderer,
  TextRenderer
} from "../renderers/index.ts";
import type { ActorComponent } from "../../actor/index.ts";

export type ScenePropertyType =
  | "string"
  | "string[]"
  | "number"
  | "number[]"
  | "boolean"
  | "boolean[]"
  | "Vector2"
  | "Vector3"
  | "Vector4"
  | "Color";

export interface ScenePropertyOptions {
  type: ScenePropertyType;
  label?: string;
  description?: string;
}

export type BehaviorKey = string | symbol;

export type BehaviorPropertyMetadata = {
  type: ScenePropertyType;
  label: string;
  description: string;
};

export type BehaviorInputListenerMetadata = {
  type: InputListenerType;
  methodName: BehaviorKey;
};

export type BehaviorMetadata = {
  properties: Map<BehaviorKey, BehaviorPropertyMetadata>;
  components: Map<BehaviorKey, SceneActorComponentType>;
  inputListeners: BehaviorInputListenerMetadata[];
};

export const BehaviorMetadataKey = Symbol.for("BehaviorMetadata");

export function SceneProperty(
  options: ScenePropertyOptions
): PropertyDecorator {
  const { type } = options;

  return function fn(
    object: Object,
    propertyName: BehaviorKey
  ): void {
    const {
      label = propertyName.toString(),
      description = ""
    } = options;

    getOrCreateBehaviorMetadata(object).properties.set(propertyName, {
      type,
      label,
      description
    });
  };
}

export type SceneActorComponentType =
  | typeof ModelRenderer
  | typeof SpriteRenderer
  | typeof TextRenderer
  | typeof ActorComponent
  | any;

export function SceneActorComponent(
  classObject: SceneActorComponentType
) {
  return function fn(
    object: Object,
    propertyName: BehaviorKey
  ): void {
    getOrCreateBehaviorMetadata(object).components.set(
      propertyName,
      classObject
    );
  };
}

/**
 * Binds a Behavior method to an input event (by dot-path name, see
 * `InputListenerType`). The listener is wired automatically during
 * behavior initialization by `BehaviorInitializer`.
 */
export function InputListener(
  type: InputListenerType
) {
  return function fn(
    object: Object,
    methodName: BehaviorKey
  ): void {
    getOrCreateBehaviorMetadata(object).inputListeners.push({
      type,
      methodName
    });
  };
}

export function getBehaviorMetadata(
  object: Object
): BehaviorMetadata | undefined {
  return Reflect.getMetadata(
    BehaviorMetadataKey,
    object
  );
}

export function createBehaviorMetadata(): BehaviorMetadata {
  return {
    properties: new Map(),
    components: new Map(),
    inputListeners: []
  };
}

function getOrCreateBehaviorMetadata(
  object: Object
): BehaviorMetadata {
  const metadata = getBehaviorMetadata(object) ?? createBehaviorMetadata();
  Reflect.defineMetadata(
    BehaviorMetadataKey,
    metadata,
    object
  );

  return metadata;
}
