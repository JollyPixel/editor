// Import Third-party Dependencies
import "reflect-metadata";

// Import Internal Dependencies
import type {
  ModelRenderer,
  SpriteRenderer,
  TextRenderer,
  TiledMapRenderer
} from "../renderers/index.js";
import type { ActorComponent } from "../../actor/index.js";

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

export type BehaviorMetadata = {
  properties: Map<BehaviorKey, BehaviorPropertyMetadata>;
  components: Map<BehaviorKey, SceneActorComponentType>;
};

export function SceneProperty(
  options: ScenePropertyOptions
): PropertyDecorator {
  const { type } = options;

  return function fn(
    object: Object,
    propertyName: BehaviorKey
  ): void {
    const { label = propertyName.toString(), description = "" } = options;

    const propertyValue: BehaviorPropertyMetadata = {
      type,
      label,
      description
    };

    const metadata = getBehaviorMetadata(object);
    if (metadata) {
      metadata.properties.set(propertyName, propertyValue);
    }
    else {
      const metadata = createBehaviorMetadata();
      metadata.properties.set(propertyName, propertyValue);

      Reflect.defineMetadata(
        SceneProperty.Metadata,
        metadata,
        object
      );
    }
  };
}
SceneProperty.Metadata = Symbol.for("BehaviorMetadata");

export type SceneActorComponentType =
  | typeof ModelRenderer
  | typeof SpriteRenderer
  | typeof TextRenderer
  | typeof TiledMapRenderer
  | typeof ActorComponent
  | any;

export function SceneActorComponent(
  classObject: SceneActorComponentType
) {
  return function fn(
    object: Object,
    propertyName: BehaviorKey
  ): void {
    const metadata = getBehaviorMetadata(object);

    if (metadata) {
      metadata.components.set(propertyName, classObject);
    }
    else {
      const metadata = createBehaviorMetadata();
      metadata.components.set(propertyName, classObject);

      Reflect.defineMetadata(
        SceneProperty.Metadata,
        metadata,
        object
      );
    }
  };
}

export function getBehaviorMetadata(
  object: Object
): BehaviorMetadata | undefined {
  return Reflect.getMetadata(SceneProperty.Metadata, object);
}

function createBehaviorMetadata(): BehaviorMetadata {
  return {
    properties: new Map(),
    components: new Map()
  };
}
