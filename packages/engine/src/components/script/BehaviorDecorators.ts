// Import Third-party Dependencies
import "reflect-metadata";
import type {
  Input,
  InputListenerType
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { Component } from "../types.ts";
import type { BehaviorPropertyType } from "./ScenePropertyValue.ts";

export interface ScenePropertyOptions {
  type: BehaviorPropertyType;
  label?: string;
  description?: string;
}

export type BehaviorKey = string | symbol;

export type BehaviorPropertyMetadata = {
  type: BehaviorPropertyType;
  label: string;
  description: string;
};

export interface InputEventTarget {
  on(eventName: string, listener: (...args: any[]) => void): unknown;
  off(eventName: string, listener: (...args: any[]) => void): unknown;
}

export type InputListenerDevice = InputListenerType extends `${infer TDevice}.${string}`
  ? TDevice
  : never;

export type BehaviorInputListenerMetadata = {
  device: InputListenerDevice;
  event: string;
  methodName: BehaviorKey;
};

export type BehaviorMetadata = {
  properties: Map<BehaviorKey, BehaviorPropertyMetadata>;
  components: Map<BehaviorKey, SceneActorComponentType>;
  inputListeners: BehaviorInputListenerMetadata[];
};

export const BehaviorMetadataKey = Symbol.for("BehaviorMetadata");

export const INPUT_LISTENER_TARGETS: Readonly<
  Record<InputListenerDevice, (input: Input) => InputEventTarget>
> = {
  input: (input) => input,
  mouse: (input) => input.mouse,
  gamepad: (input) => input.gamepad,
  touchpad: (input) => input.touchpad,
  screen: (input) => input.screen,
  keyboard: (input) => input.keyboard
};

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

export type SceneActorComponentType = abstract new (...args: any[]) => Component;

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

export function InputListener(
  type: InputListenerType
) {
  return function fn(
    object: Object,
    methodName: BehaviorKey
  ): void {
    const separator = type.indexOf(".");
    const device = type.slice(0, separator);
    if (!Object.hasOwn(INPUT_LISTENER_TARGETS, device)) {
      throw new Error(`Unknown input listener "${type}".`);
    }

    getOrCreateBehaviorMetadata(object).inputListeners.push({
      device: device as InputListenerDevice,
      event: type.slice(separator + 1),
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
