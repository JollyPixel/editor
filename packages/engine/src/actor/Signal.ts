// Import Third-party Dependencies
import "reflect-metadata";

// CONSTANTS
const kActorComponentSignalKey = Symbol("ActorComponentSignalKey");

export interface SignalMetadata {
  signals: Set<string>;
}

export type SignalListener<T extends unknown[]> = (...args: T[]) => void;

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
    const metadata = getActorComponentMetadata(object);
    if (metadata) {
      metadata.signals.add(propertyName.toString());
    }
    else {
      const metadata = createActorComponentMetadata();
      metadata.signals.add(propertyName.toString());

      Reflect.defineMetadata(
        kActorComponentSignalKey,
        metadata,
        object
      );
    }
  };
}

function createActorComponentMetadata(): SignalMetadata {
  return {
    signals: new Set<string>()
  };
}

export function getActorComponentMetadata(
  object: Object
): SignalMetadata | undefined {
  return Reflect.getMetadata(kActorComponentSignalKey, object);
}
