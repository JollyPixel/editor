// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import type { TextureImportOrigin } from "./textures.ts";

// CONSTANTS
const kBusyDelayMs = 150;

export interface TextureBusyState {
  origin: TextureImportOrigin;
  label: string;
}

export class TextureBusy {
  #host: ReactiveControllerHost;
  #state: TextureBusyState | null = null;
  #pending: TextureBusyState | null = null;
  #generation = 0;
  #timer: number | null = null;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
  }

  get state(): TextureBusyState | null {
    return this.#state;
  }

  begin(
    origin: TextureImportOrigin,
    label: string
  ): () => void {
    const generation = ++this.#generation;
    this.#clearTimer();

    const state: TextureBusyState = {
      origin,
      label
    };
    if (this.#state === null) {
      this.#pending = state;
      this.#timer = window.setTimeout(
        () => this.#paint(generation),
        kBusyDelayMs
      );
    }
    else {
      this.#state = state;
      this.#host.requestUpdate();
    }

    return () => this.#release(generation);
  }

  clear(): void {
    this.#generation++;
    this.#clearTimer();
    this.#pending = null;
    if (this.#state === null) {
      return;
    }

    this.#state = null;
    this.#host.requestUpdate();
  }

  #paint(
    generation: number
  ): void {
    this.#timer = null;
    if (generation !== this.#generation || this.#pending === null) {
      return;
    }

    this.#state = this.#pending;
    this.#pending = null;
    this.#host.requestUpdate();
  }

  #release(
    generation: number
  ): void {
    if (generation !== this.#generation) {
      return;
    }

    this.clear();
  }

  #clearTimer(): void {
    if (this.#timer === null) {
      return;
    }

    window.clearTimeout(this.#timer);
    this.#timer = null;
  }
}
