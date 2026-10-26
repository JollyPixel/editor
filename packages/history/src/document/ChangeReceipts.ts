// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type ChangeReceiptsEvents<TChange> = {
  confirmed: (
    change: TChange,
    version: number | undefined
  ) => void;
  refused: (
    change: TChange
  ) => void;
};

export class ChangeReceipts<TChange> {
  #events = new Emitter<ChangeReceiptsEvents<TChange>>();
  #attached = false;

  get attached(): boolean {
    return this.#attached;
  }

  attach(): () => void {
    if (this.#attached) {
      throw new Error("ChangeReceipts: a sync client already writes these receipts.");
    }
    this.#attached = true;

    return () => {
      this.#attached = false;
    };
  }

  subscribe<TEvent extends keyof ChangeReceiptsEvents<TChange>>(
    event: TEvent,
    listener: ChangeReceiptsEvents<TChange>[TEvent]
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  confirm(
    change: TChange,
    version: number | undefined
  ): void {
    this.#events.emit(
      "confirmed",
      change,
      version
    );
  }

  refuse(
    change: TChange
  ): void {
    this.#events.emit(
      "refused",
      change
    );
  }
}
