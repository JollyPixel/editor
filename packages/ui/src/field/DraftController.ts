// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import { isInputElement } from "../dom.ts";

export type DraftResult<TValue> =
  | { ok: true; value: TValue; }
  | { ok: false; error: string; };

/**
 * Manages the common input, keyboard, blur, and parse lifecycle of a draft.
 */
export class DraftController<TValue> {
  #host: ReactiveControllerHost;
  #draft: string | null = null;
  #error: string | null = null;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
  }

  get draft(): string | null {
    return this.#draft;
  }

  get error(): string | null {
    return this.#error;
  }

  setDraft(
    text: string | null
  ): void {
    if (this.#draft === text) {
      return;
    }

    this.#draft = text;
    this.#host.requestUpdate();
  }

  setError(
    message: string | null
  ): void {
    if (this.#error === message) {
      return;
    }

    this.#error = message;
    this.#host.requestUpdate();
  }

  clear(): void {
    this.setDraft(null);
    this.setError(null);
  }

  onInput(
    event: Event
  ): void {
    if (!isInputElement(event.target)) {
      return;
    }

    this.setDraft(event.target.value);
    this.setError(null);
  }

  onKeyDown(
    event: KeyboardEvent,
    commit: () => void
  ): void {
    if (event.key === "Enter") {
      commit();
    }
    else if (event.key === "Escape") {
      // Keep parent popovers open while discarding a draft.
      event.stopPropagation();
      this.clear();
    }
  }

  commit(
    parse: (text: string) => DraftResult<TValue> | null,
    editable: boolean,
    onCommit: (value: TValue) => void
  ): void {
    const draft = this.#draft;
    if (draft === null || !editable) {
      return;
    }

    const result = parse(draft);
    if (result === null) {
      this.clear();

      return;
    }
    if (!result.ok) {
      this.setError(result.error);

      return;
    }

    this.clear();
    onCommit(result.value);
  }
}
