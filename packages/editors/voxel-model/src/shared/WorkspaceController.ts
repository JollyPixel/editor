// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

export type WorkspaceSubscriber<W> = (
  workspace: W
) => Iterable<() => void>;

export class WorkspaceController<W> implements ReactiveController {
  #host: ReactiveControllerHost;
  #subscribe: WorkspaceSubscriber<W>;
  #workspace: W | null = null;
  #connected = false;
  #subscriptions: Array<() => void> = [];

  get current(): W | null {
    return this.#workspace;
  }

  constructor(
    host: ReactiveControllerHost,
    subscribe: WorkspaceSubscriber<W> = () => []
  ) {
    this.#host = host;
    this.#subscribe = subscribe;
    host.addController(this);
  }

  attach(
    workspace: W
  ): void {
    this.#workspace = workspace;
    this.#resubscribe();
    this.#host.requestUpdate();
  }

  hostConnected(): void {
    this.#connected = true;
    this.#resubscribe();
  }

  hostDisconnected(): void {
    this.#connected = false;
    this.#release();
  }

  #resubscribe(): void {
    this.#release();
    if (this.#connected && this.#workspace !== null) {
      this.#subscriptions.push(...this.#subscribe(this.#workspace));
    }
  }

  #release(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }
}
