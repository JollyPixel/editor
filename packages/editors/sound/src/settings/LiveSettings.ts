// Import Third-party Dependencies
import type {
  SoundDocument,
  SoundSettingsChange
} from "@jolly-pixel/asset.sound/client";
import { Systems } from "@jolly-pixel/engine/core";
import { Emitter } from "@openally/emitt";

export type LiveSettingsEvents = {
  change: () => void;
};

export class LiveSettings {
  readonly document: SoundDocument;

  #events = new Emitter<LiveSettingsEvents>();
  #preview: Systems.SoundSettingsInput = {};
  #current: Readonly<Systems.SoundSettings>;
  #unsubscribe: Array<() => void>;

  constructor(
    document: SoundDocument
  ) {
    this.document = document;
    this.#current = document.settings;
    this.#unsubscribe = [
      document.subscribe("change", () => this.#refresh()),
      document.subscribe("reset", () => {
        this.#preview = {};
        this.#refresh();
      })
    ];
  }

  get current(): Readonly<Systems.SoundSettings> {
    return this.#current;
  }

  subscribe(
    event: keyof LiveSettingsEvents,
    listener: () => void
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  preview(
    change: Systems.SoundSettingsInput
  ): void {
    this.#preview = {
      ...this.#preview,
      ...change,
      spatial: {
        ...this.#preview.spatial,
        ...change.spatial
      }
    };
    this.#refresh();
  }

  commit(
    change: Systems.SoundSettingsInput
  ): void {
    const next = Systems.mergeSoundSettings(this.document.settings, change);
    const keys = Object.keys(change) as (keyof Systems.SoundSettings)[];
    const resolved: SoundSettingsChange = Object.fromEntries(
      keys.map((key) => [key, next[key]])
    );
    this.#preview = {};
    if (!this.document.change(resolved)) {
      this.#refresh();
    }
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
    this.#events.removeAllListeners();
  }

  #refresh(): void {
    this.#current = Systems.mergeSoundSettings(
      this.document.settings,
      this.#preview
    );
    this.#events.emit("change");
  }
}
