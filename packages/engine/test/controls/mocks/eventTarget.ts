// Import Third-party Dependencies
import { Event } from "happy-dom";

export class EventTargetAdapter {
  protected listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(
    type: string,
    listener: (event: Event) => void
  ) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(
    type: string,
    listener: (event: Event) => void
  ) {
    this.listeners.get(type)?.delete(listener);
  }
}
