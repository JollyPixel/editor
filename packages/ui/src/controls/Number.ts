// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { JollyField } from "../field/JollyField.ts";
import { MIXED_PLACEHOLDER } from "../field/mixed.ts";
import {
  formatNumber,
  parseNumeric,
  quantize
} from "../numeric/format.ts";
import { ScrubController } from "../interaction/scrub/ScrubController.ts";
import { multiplierFor } from "../numeric/modifierMultiplier.ts";
import { valueFromDelta } from "../numeric/valueFromDelta.ts";
import { numberStyles } from "./Number.styles.ts";
import { PointerFocusController } from "../field/PointerFocusController.ts";

export interface NumberFieldDefaults {
  step: number;
  min: number;
  max: number;
  value: number;
}

/**
 * Supports expression entry and pointer scrubbing through a text input.
 */
@customElement("jolly-number")
export class NumberField extends JollyField<number> {
  static readonly Defaults: NumberFieldDefaults = {
    step: 1,
    /**
     * Number fields are unbounded by default.
     */
    min: Number.NEGATIVE_INFINITY,
    max: Number.POSITIVE_INFINITY,
    value: 0
  };

  static override styles = [
    ...JollyField.styles,
    numberStyles
  ];

  @property({ type: Number })
  declare step: number;

  @property({ type: Number })
  declare min: number;

  @property({ type: Number })
  declare max: number;

  #scrub = new ScrubController(this, {
    target: () => this.renderRoot.querySelector(".scrub-handle"),
    step: () => this.step,
    start: () => (this.editable ? this.concreteValue : undefined),
    min: () => this.min,
    max: () => this.max,
    onInput: (value) => this.emitInput(value),
    onCommit: (value) => this.emitChange(value)
  });

  #pointerFocus = new PointerFocusController(this);

  constructor() {
    super();

    this.step = NumberField.Defaults.step;
    this.min = NumberField.Defaults.min;
    this.max = NumberField.Defaults.max;
    this.value = NumberField.Defaults.value;
  }

  /**
   * Mixed values cannot be scrubbed.
   */
  protected override get scrubbable(): boolean {
    return this.editable && !this.mixed;
  }

  protected renderValue(): TemplateResult {
    return html`
      <div class="wrap">
        <span class="scrub-handle" aria-hidden="true"></span>
        <input
          type="text"
          inputmode="decimal"
          .value=${this.draft ?? this.#displayed}
          placeholder=${this.mixed ? MIXED_PLACEHOLDER : ""}
          ?disabled=${this.disabled}
          ?readonly=${this.inputReadonly}
          ?data-pointer-focus=${this.#pointerFocus.active}
          aria-readonly=${this.readonlyAria}
          aria-disabled=${this.lockedAria}
          aria-description=${this.lockDescription}
          aria-invalid=${this.displayError === null ? nothing : "true"}
          @input=${this.onDraftInput}
          @focus=${this.#pointerFocus.onFocus}
          @keydown=${this.#onKeyDown}
          @blur=${this.#onBlur}
        >
      </div>
    `;
  }

  get #displayed(): string {
    const value = this.concreteValue;

    return value === undefined ? "" : formatNumber(value, this.step);
  }

  #onKeyDown(
    event: KeyboardEvent
  ): void {
    this.#pointerFocus.onKeyDown();

    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    ) {
      this.#step(event);
    }
    else {
      this.onDraftKeyDown(
        event,
        () => this.#commit()
      );
    }
  }

  #onBlur(): void {
    this.#pointerFocus.onBlur();
    this.#commit();
  }

  /**
   * Commits one modifier-scaled step from the current value.
   */
  #step(
    event: KeyboardEvent
  ): void {
    const start = this.editable ? this.concreteValue : undefined;
    if (start === undefined) {
      return;
    }

    // Prevent the input caret from moving.
    event.preventDefault();

    const direction = event.key === "ArrowUp" ? 1 : -1;
    // Scale the step, not the count, so Alt can produce fractional steps.
    const effectiveStep = this.step * multiplierFor(event);

    this.emitChange(
      valueFromDelta({
        start,
        deltaPx: direction,
        step: effectiveStep,
        pixelsPerStep: 1,
        min: this.min,
        max: this.max
      })
    );
  }

  #commit(): void {
    if (this.#scrub.dragging) {
      return;
    }

    this.commitDraft((draft) => {
      const result = parseNumeric(draft);
      if (result === null || !result.ok) {
        return result;
      }

      return {
        ok: true,
        value: quantize(
          result.value,
          this.step,
          this.min,
          this.max
        )
      };
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-number": NumberField;
  }
}
