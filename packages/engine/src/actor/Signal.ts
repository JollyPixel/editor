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

