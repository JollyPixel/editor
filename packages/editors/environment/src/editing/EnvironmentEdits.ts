// Import Third-party Dependencies
import type {
  EnvironmentChange,
  EnvironmentDocument,
  EnvironmentFile
} from "@jolly-pixel/asset.environment/client";
import { Emitter } from "@openally/emitt";

export type EnvironmentEditsEvents = {
  change: () => void;
};

export class EnvironmentEdits extends Emitter<EnvironmentEditsEvents> {
  #document: EnvironmentDocument;
  #pending: EnvironmentChange = {};
  #unsubscribe: Array<() => void>;

  constructor(
    document: EnvironmentDocument
  ) {
    super();
    this.#document = document;
    this.#unsubscribe = [
      document.subscribe("change", () => this.emit("change")),
      document.subscribe("reset", () => {
        this.#pending = {};
        this.emit("change");
      })
    ];
  }

  get file(): Readonly<EnvironmentFile> {
    return {
      ...this.#document.file,
      ...this.#pending
    };
  }

  preview(
    change: EnvironmentChange
  ): void {
    this.#pending = {
      ...this.#pending,
      ...change
    };
    this.emit("change");
  }

  commit(
    change: EnvironmentChange
  ): void {
    this.#pending = {};
    if (!this.#document.change(change)) {
      this.emit("change");
    }
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
  }
}
