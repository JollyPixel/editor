// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type PeerLayerEvent = {
  changed: () => void;
};

export abstract class PeerLayer<TState> extends Emitter<PeerLayerEvent> {
  readonly #states = new Map<string, TState>();

  get isActive(): boolean {
    return this.#states.size > 0;
  }

  set(
    clientId: string,
    state: TState
  ): void {
    this.#states.set(clientId, state);
    this.stateChanged(clientId, state);
    this.emit("changed");
  }

  remove(
    clientId: string
  ): void {
    if (this.#states.delete(clientId)) {
      this.stateRemoved(clientId);
      this.emit("changed");
    }
  }

  removeWhere(
    predicate: (state: TState) => boolean
  ): void {
    for (const [clientId, state] of [...this.#states]) {
      if (predicate(state)) {
        this.remove(clientId);
      }
    }
  }

  clearAll(): void {
    this.removeWhere(() => true);
  }

  destroy(): void {
    this.clearAll();
  }

  protected states(): IterableIterator<[string, TState]> {
    return this.#states.entries();
  }

  protected stateChanged(
    _clientId: string,
    _state: TState
  ): void {
    return;
  }

  protected stateRemoved(
    _clientId: string
  ): void {
    return;
  }
}
