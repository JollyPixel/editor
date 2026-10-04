// Import Internal Dependencies
import { PeerLayer } from "./PeerLayer.ts";

export abstract class PeerRegistry<TState, TView> extends PeerLayer<TState> {
  readonly #views = new Map<string, TView>();

  refresh(): void {
    for (const [clientId, state] of this.states()) {
      this.#render(clientId, state);
    }
  }

  protected stateChanged(
    clientId: string,
    state: TState
  ): void {
    this.#render(clientId, state);
  }

  protected stateRemoved(
    clientId: string
  ): void {
    const view = this.#views.get(clientId);
    if (view !== undefined) {
      this.disposeView(view);
      this.#views.delete(clientId);
    }
  }

  protected abstract createView(): TView;

  protected abstract renderView(
    view: TView,
    state: TState
  ): void;

  protected abstract disposeView(
    view: TView
  ): void;

  #render(
    clientId: string,
    state: TState
  ): void {
    let view = this.#views.get(clientId);
    if (view === undefined) {
      view = this.createView();
      this.#views.set(clientId, view);
    }

    this.renderView(view, state);
  }
}
