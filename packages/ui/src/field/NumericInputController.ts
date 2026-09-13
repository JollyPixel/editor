// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import type { DraftController } from "./DraftController.ts";
import { PointerFocusController } from "./PointerFocusController.ts";
import { ScrubController } from "../interaction/scrub/ScrubController.ts";
import {
  formatNumber,
  parseNumericEntry,
  stepNumericEntry,
  type NumericBounds
} from "../numeric/entry.ts";

export interface NumericInputOptions {
  draft: DraftController<number>;
  step(): number;
  min(): number;
  max(): number;
  value(): number | undefined;
  editable(): boolean;
  coerce?(value: number): number;
  onInput(value: number): void;
  onChange(value: number): void;
  scrubTarget?(): HTMLElement | null;
}

export class NumericInputController {
  readonly #options: NumericInputOptions;
  readonly #pointerFocus: PointerFocusController;
  readonly #scrub: ScrubController | null;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    options: NumericInputOptions
  ) {
    this.#options = options;
    this.#pointerFocus = new PointerFocusController(host);
    const { scrubTarget } = options;
    this.#scrub = scrubTarget === undefined ?
      null :
      new ScrubController(host, {
        target: scrubTarget,
        step: () => options.step(),
        start: () => this.#start(),
        min: () => options.min(),
        max: () => options.max(),
        onInput: (value) => {
          options.draft.clear();
          options.onInput(this.#coerce(value));
        },
        onCommit: (value) => {
          options.draft.clear();
          options.onChange(this.#coerce(value));
        }
      });
  }

  get dragging(): boolean {
    return this.#scrub?.dragging ?? false;
  }

  get pointerFocused(): boolean {
    return this.#pointerFocus.active;
  }

  get error(): string | null {
    return this.#options.draft.error;
  }

  get displayed(): string {
    const draft = this.#options.draft.draft;
    if (draft !== null) {
      return draft;
    }

    const value = this.#options.value();

    return value === undefined ?
      "" :
      formatNumber(value, this.#options.step());
  }

  onInput = (
    event: Event
  ): void => {
    this.#options.draft.onInput(event);
  };

  onFocus = (): void => {
    this.#pointerFocus.onFocus();
  };

  onKeyDown = (
    event: KeyboardEvent
  ): void => {
    this.#pointerFocus.onKeyDown();

    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    ) {
      this.#step(event);
    }
    else {
      this.#options.draft.onKeyDown(
        event,
        () => this.commit()
      );
    }
  };

  onBlur = (): void => {
    this.#pointerFocus.onBlur();
    this.commit();
  };

  commit(): void {
    if (this.dragging) {
      return;
    }

    this.#options.draft.commit(
      (text) => parseNumericEntry(text, this.#bounds()),
      this.#options.editable(),
      (value) => this.#options.onChange(this.#coerce(value))
    );
  }

  #step(
    event: KeyboardEvent
  ): void {
    const start = this.#start();
    if (start === undefined) {
      return;
    }

    event.preventDefault();
    this.#options.draft.clear();
    this.#options.onChange(this.#coerce(stepNumericEntry(
      start,
      event.key === "ArrowUp" ? 1 : -1,
      event,
      this.#bounds()
    )));
  }

  #start(): number | undefined {
    return this.#options.editable() ?
      this.#options.value() :
      undefined;
  }

  #coerce(
    value: number
  ): number {
    return this.#options.coerce?.(value) ?? value;
  }

  #bounds(): NumericBounds {
    return {
      step: this.#options.step(),
      min: this.#options.min(),
      max: this.#options.max()
    };
  }
}
