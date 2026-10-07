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
  discarded: () => void;
};

export class ChangeReceipts<
  TChange
> extends Emitter<ChangeReceiptsEvents<TChange>> {
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

  confirm(
    change: TChange,
    version: number | undefined
  ): void {
    this.emit(
      "confirmed",
      change,
      version
    );
  }

  refuse(
    change: TChange
  ): void {
    this.emit(
      "refused",
      change
    );
  }

  discard(): void {
    this.emit("discarded");
  }
}
