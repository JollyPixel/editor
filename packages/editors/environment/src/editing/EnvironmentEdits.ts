// Import Third-party Dependencies
import type {
  EnvironmentChange,
  EnvironmentDocument,
  EnvironmentFile
} from "@jolly-pixel/asset.environment/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { EnvironmentAccessSource } from "../access/EnvironmentAccess.ts";

export type EnvironmentEditsEvents = {
  change: () => void;
};

export class EnvironmentEdits extends Emitter<EnvironmentEditsEvents> {
  #document: EnvironmentDocument;
  #access: EnvironmentAccessSource;
  #pending: EnvironmentChange = {};
  #unsubscribe: Array<() => void>;

  constructor(
    document: EnvironmentDocument,
    access: EnvironmentAccessSource
  ) {
    super();
    this.#document = document;
    this.#access = access;
    this.#unsubscribe = [
      document.subscribe("change", () => this.emit("change")),
      document.subscribe("reset", () => {
        this.#pending = {};
        this.emit("change");
      }),
      access.subscribe("change", () => {
        if (!this.editable) {
          this.#pending = {};
        }
        this.emit("change");
      })
    ];
  }

  get editable(): boolean {
    return this.#access.current.has("settings");
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
    if (!this.editable) {
      return;
    }

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
    if (!this.editable || !this.#document.change(change)) {
      this.emit("change");
    }
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
  }
}
