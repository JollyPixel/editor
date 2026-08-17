// Import Third-party Dependencies
import {
  html,
  nothing,
  type LitElement,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import { ScrubController } from "../interaction/scrub/ScrubController.ts";
import { multiplierFor } from "../numeric/modifierMultiplier.ts";
import { valueFromDelta } from "../numeric/valueFromDelta.ts";
import {
  formatNumber,
  parseNumeric,
  quantize
} from "../numeric/format.ts";
import { MIXED_PLACEHOLDER } from "../field/mixed.ts";
import { isInputElement } from "../dom.ts";

export interface AxisControllerOptions {
  /**
   * Matches the box's `data-axis` attribute,
   * used to target its scrub handle.
   */
  key: string;
  /**
   * Short glyph shown in the corner chip, e.g. "X".
   */
  label: string;
  ariaLabel(): string;
  /**
   * CSS custom property name for the corner chip color, e.g. "--jolly-axis-x".
   */
  colorVar?: string;
  step(): number;
  min(): number;
  max(): number;
  /** `undefined` renders the mixed placeholder and blocks scrubbing. */
  value(): number | undefined;
  editable(): boolean;
  disabled(): boolean;
  onInput(
    value: number
  ): void;
  onChange(
    value: number
  ): void;
}

/**
 * Coordinates one axis's scrub handle, expression input and keyboard steps.
 * ScrubController owns host lifecycle; drafts change only in event handlers.
 */
export class AxisController {
  #host: LitElement;
  #options: AxisControllerOptions;
  #draft: string | null = null;
  #error: string | null = null;
  #scrub: ScrubController;

  constructor(
    host: LitElement,
    options: AxisControllerOptions
  ) {
    this.#host = host;
    this.#options = options;
    this.#scrub = new ScrubController(host, {
      target: () => this.#host.renderRoot.querySelector(
        `.axis-box[data-axis="${options.key}"] .scrub-handle`
      ),
      step: () => options.step(),
      start: () => (options.editable() ? options.value() : undefined),
      min: () => options.min(),
      max: () => options.max(),
      onInput: (value) => {
        this.#draft = null;
        options.onInput(value);
      },
      onCommit: (value) => {
        this.#draft = null;
        options.onChange(value);
      }
    });
  }

  get dragging(): boolean {
    return this.#scrub.dragging;
  }

  render(): TemplateResult {
    const { key, label, colorVar } = this.#options;
    const value = this.#options.value();
    const displayed = this.#draft ?? (
      value === undefined ? "" : formatNumber(value, this.#options.step())
    );
    const showMixed = this.#draft === null && value === undefined;

    return html`
      <span
        class="axis-box"
        data-axis=${key}
        style=${colorVar ? `--jolly-axis-color: var(${colorVar})` : nothing}
      >
        <span class="axis-tag" aria-hidden="true">${label}</span>
        <span class="scrub-handle" aria-hidden="true"></span>
        <input
          type="text"
          inputmode="decimal"
          aria-label=${this.#options.ariaLabel()}
          .value=${displayed}
          placeholder=${showMixed ? MIXED_PLACEHOLDER : ""}
          ?disabled=${this.#options.disabled()}
          ?readonly=${!this.#options.editable()}
          aria-invalid=${this.#error === null ? nothing : "true"}
          @input=${this.#onInput}
          @keydown=${this.#onKeyDown}
          @blur=${this.#onBlur}
        >
      </span>
    `;
  }

  #onInput = (
    event: Event
  ): void => {
    if (!isInputElement(event.target)) {
      return;
    }

    this.#draft = event.target.value;
    this.#error = null;
    this.#host.requestUpdate();
  };

  #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.key === "Enter") {
      this.#commit();
    }
    else if (event.key === "Escape") {
      // Keep parent popovers open while discarding a draft.
      event.stopPropagation();
      this.#clear();
    }
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      this.#step(event);
    }
  };

  #onBlur = (): void => {
    if (this.#scrub.dragging) {
      return;
    }

    this.#commit();
  };

  #step(
    event: KeyboardEvent
  ): void {
    const start = this.#options.editable() ? this.#options.value() : undefined;
    if (start === undefined) {
      return;
    }

    // Prevent the input caret from moving.
    event.preventDefault();

    const direction = event.key === "ArrowUp" ? 1 : -1;
    const step = this.#options.step() * multiplierFor(event);

    this.#options.onChange(
      valueFromDelta({
        start,
        deltaPx: direction,
        step,
        pixelsPerStep: 1,
        min: this.#options.min(),
        max: this.#options.max()
      })
    );
  }

  #commit(): void {
    if (
      this.#scrub.dragging ||
      this.#draft === null ||
      !this.#options.editable()
    ) {
      return;
    }

    const result = parseNumeric(this.#draft);
    if (result === null) {
      this.#clear();

      return;
    }
    if (!result.ok) {
      this.#error = result.error;
      this.#host.requestUpdate();

      return;
    }

    this.#clear();
    this.#options.onChange(
      quantize(
        result.value,
        this.#options.step(),
        this.#options.min(),
        this.#options.max()
      )
    );
  }

  #clear(): void {
    this.#draft = null;
    this.#error = null;
    this.#host.requestUpdate();
  }
}
