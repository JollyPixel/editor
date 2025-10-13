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
  | "Vector3";

export interface ScenePropertyOptions {
  type: ScenePropertyType;
}

export type BehaviorKey = string | symbol;

export type BehaviorMetadata = {
  properties: Map<BehaviorKey, ScenePropertyType>;
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
    const metadata = getBehaviorMetadata(object);
    if (metadata) {
      metadata.properties.set(propertyName, type);
    }
    else {
      const metadata = createBehaviorMetadata();
      metadata.properties.set(propertyName, type);

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
  | typeof ActorComponent;

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
