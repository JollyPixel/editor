// Import Third-party Dependencies
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

export type BehaviorDecoratorContext =
  | ClassFieldDecoratorContext
  | ClassMethodDecoratorContext;

export interface BehaviorFieldDecorator {
  (target: object, propertyName: BehaviorKey): void;
  (value: undefined, context: ClassFieldDecoratorContext): void;
}

export interface BehaviorMethodDecorator {
  (target: object, methodName: BehaviorKey, descriptor?: PropertyDescriptor): void;
  (value: (...args: any[]) => unknown, context: ClassMethodDecoratorContext): void;
}

interface DeclaredMember {
  metadata: BehaviorMetadata;
  name: BehaviorKey;
}

export const BehaviorMetadataKey = Symbol.for("BehaviorMetadata");

// CONSTANTS
const kSymbolMetadata = installSymbolMetadata();

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
): BehaviorFieldDecorator {
  const { type } = options;

  return function fn(
    target: object | undefined,
    key: BehaviorKey | ClassFieldDecoratorContext
  ): void {
    const { metadata, name } = declareMember(target, key);
    const {
      label = name.toString(),
      description = ""
    } = options;

    metadata.properties.set(name, {
      type,
      label,
      description
    });
  };
}

export type SceneActorComponentType = abstract new (...args: any[]) => Component;

export function SceneActorComponent(
  classObject: SceneActorComponentType
): BehaviorFieldDecorator {
  return function fn(
    target: object | undefined,
    key: BehaviorKey | ClassFieldDecoratorContext
  ): void {
    const { metadata, name } = declareMember(target, key);
    metadata.components.set(name, classObject);
  };
}

export function InputListener(
  type: InputListenerType
): BehaviorMethodDecorator {
  return function fn(
    target: object,
    key: BehaviorKey | ClassMethodDecoratorContext
  ): void {
    const separator = type.indexOf(".");
    const device = type.slice(0, separator);
    if (!Object.hasOwn(INPUT_LISTENER_TARGETS, device)) {
      throw new Error(`Unknown input listener "${type}".`);
    }

    const { metadata, name } = declareMember(target, key);
    metadata.inputListeners.push({
      device: device as InputListenerDevice,
      event: type.slice(separator + 1),
      methodName: name
    });
  };
}

export function getBehaviorMetadata(
  object: object
): BehaviorMetadata | undefined {
  return Reflect.get(object, BehaviorMetadataKey) ??
    Reflect.get(object.constructor, kSymbolMetadata)?.[BehaviorMetadataKey];
}

function declareMember(
  target: object | undefined,
  key: BehaviorKey | BehaviorDecoratorContext
): DeclaredMember {
  const holder = typeof key === "object" ? key.metadata : target;
  if (holder === undefined) {
    throw new TypeError("A behavior decorator must decorate a class member.");
  }

  return {
    metadata: getOrCreateBehaviorMetadata(holder),
    name: typeof key === "object" ? key.name : key
  };
}

function installSymbolMetadata(): symbol {
  const native: unknown = Reflect.get(Symbol, "metadata");
  if (typeof native === "symbol") {
    return native;
  }

  const metadata = Symbol.for("Symbol.metadata");
  Reflect.defineProperty(Symbol, "metadata", {
    value: metadata
  });

  return metadata;
}

function getOrCreateBehaviorMetadata(
  object: object
): BehaviorMetadata {
  const current: BehaviorMetadata | undefined = Reflect.get(
    object,
    BehaviorMetadataKey
  );
  if (current !== undefined && Object.hasOwn(object, BehaviorMetadataKey)) {
    return current;
  }

  const metadata: BehaviorMetadata = {
    properties: new Map(current?.properties),
    components: new Map(current?.components),
    inputListeners: [...current?.inputListeners ?? []]
  };
  Object.defineProperty(object, BehaviorMetadataKey, {
    value: metadata
  });

  return metadata;
}
