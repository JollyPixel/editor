// Import Third-party Dependencies
import {
  html,
  nothing,
  type LitElement,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import { DraftController } from "../field/DraftController.ts";
import { MIXED_PLACEHOLDER } from "../field/mixed.ts";
import { NumericInputController } from "../field/NumericInputController.ts";

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
 */
export class AxisController {
  #options: AxisControllerOptions;
  #draft: DraftController<number>;
  #input: NumericInputController;

  constructor(
    host: LitElement,
    options: AxisControllerOptions
  ) {
    this.#options = options;
    this.#draft = new DraftController<number>(host);
    this.#input = new NumericInputController(host, {
      draft: this.#draft,
      step: () => options.step(),
      min: () => options.min(),
      max: () => options.max(),
      value: () => options.value(),
      editable: () => options.editable(),
      onInput: (value) => options.onInput(value),
      onChange: (value) => options.onChange(value),
      scrubTarget: () => host.renderRoot.querySelector(
        `.axis-box[data-axis="${options.key}"] .scrub-handle`
      )
    });
  }

  get dragging(): boolean {
    return this.#input.dragging;
  }

  get error(): string | null {
    return this.#input.error;
  }

  render(): TemplateResult {
    const { key, label, colorVar } = this.#options;
    const showMixed = this.#draft.draft === null &&
      this.#options.value() === undefined;

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
          .value=${this.#input.displayed}
          placeholder=${showMixed ? MIXED_PLACEHOLDER : ""}
          ?disabled=${this.#options.disabled()}
          ?readonly=${!this.#options.editable()}
          ?data-pointer-focus=${this.#input.pointerFocused}
          aria-invalid=${this.error === null ? nothing : "true"}
          @input=${this.#input.onInput}
          @focus=${this.#input.onFocus}
          @keydown=${this.#input.onKeyDown}
          @blur=${this.#input.onBlur}
        >
      </span>
    `;
  }
}
