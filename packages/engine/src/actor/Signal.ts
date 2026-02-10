// Import Third-party Dependencies
import "reflect-metadata";

// Import Internal Dependencies
import {
  getBehaviorMetadata,
  createBehaviorMetadata
} from "../components/script/BehaviorDecorators.ts";

export type SignalListener<T extends unknown[]> = (...args: T[]) => void;

export type ActorComponentSignalMetadata = {
  signals: Set<string>;
};

export class SignalEvent<T extends unknown[] = []> {
  private listeners: SignalListener<T>[] = [];

  emit(...args: T) {
    this.listeners.forEach((listener) => {
      listener(...args as any);
    });
  }

  connect(
    listener: SignalListener<T>
  ) {
    this.listeners.push(listener);
  }

  disconnect(
    listener: SignalListener<T>
  ) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  clear() {
    this.listeners = [];
  }
}

export function Signal(): PropertyDecorator {
  return function fn(
    object: Object,
    propertyName: string | symbol
  ): void {
    const metadata = getBehaviorMetadata(object);
    if (metadata) {
      metadata.signals.add(propertyName.toString());
    }
    else {
      const metadata = createBehaviorMetadata();
      metadata.signals.add(propertyName.toString());

      Reflect.defineMetadata(
        Symbol.for("BehaviorMetadata"),
        metadata,
        object
      );
    }
  };
}
