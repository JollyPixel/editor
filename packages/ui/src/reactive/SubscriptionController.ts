// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

export type SourceSubscriber<TSource> = (
  source: TSource
) => Iterable<() => void>;

export class SubscriptionController<TSource> implements ReactiveController {
  #host: ReactiveControllerHost;
  #subscribe: SourceSubscriber<TSource>;
  #source: TSource | null = null;
  #connected = false;
  #subscriptions: Array<() => void> = [];

  get current(): TSource | null {
    return this.#source;
  }

  get attached(): TSource {
    if (this.#source === null) {
      throw new Error("No source is attached yet.");
    }

    return this.#source;
  }

  constructor(
    host: ReactiveControllerHost,
    subscribe: SourceSubscriber<TSource> = () => []
  ) {
    this.#host = host;
    this.#subscribe = subscribe;
    host.addController(this);
  }

  attach(
    source: TSource
  ): void {
    this.#source = source;
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
    if (this.#connected && this.#source !== null) {
      this.#subscriptions.push(...this.#subscribe(this.#source));
    }
  }

  #release(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }
}
