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
import { buttonGroupStyles } from "./ButtonGroup.styles.ts";
import { nextEnabledIndex } from "./roving.ts";
import type { JollyOption } from "./types.ts";

export interface ButtonGroupDefaults {
  layout: "segmented" | "grid";
  columns: number;
}

// CONSTANTS
const kArrowSteps: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1
};

/**
 * Sentinel for keys outside arrow-key navigation.
 */
const kNoStep = 0;

/**
 * Segmented or grid selector with roving tab navigation.
 */
@customElement("jolly-button-group")
export class ButtonGroup<TValue> extends JollyField<TValue> {
  static readonly Defaults: ButtonGroupDefaults = {
    layout: "segmented",
    /**
     * Zero columns uses the intrinsic grid layout.
     */
    columns: 0
  };

  static override styles = [
    ...JollyField.styles,
    buttonGroupStyles
  ];

  @property({ attribute: false })
  declare options: JollyOption<TValue>[];

  @property({ type: String, reflect: true })
  declare layout: "segmented" | "grid";

  @property({ type: Number })
  declare columns: number;

  constructor() {
    super();

    this.options = [];
    this.layout = ButtonGroup.Defaults.layout;
    this.columns = ButtonGroup.Defaults.columns;
  }

  protected renderValue(): TemplateResult {
    const columns = this.layout === "grid" && this.columns > 0
      ? `grid-template-columns: repeat(${this.columns}, 1fr)`
      : nothing;

    return html`
      <div
        class="group"
        role="radiogroup"
        aria-label=${this.label}
        aria-readonly=${this.readonlyAria}
        aria-disabled=${this.lockedAria}
        aria-description=${this.lockDescription}
        style=${columns}
        @keydown=${this.#onKeyDown}
      >
        ${this.options.map(
          (option, index) => this.#renderOption(option, index)
        )}
      </div>
    `;
  }

  #renderOption(
    option: JollyOption<TValue>,
    index: number
  ): TemplateResult {
    const selected = this.#selectedIndex === index;

    return html`
      <button
        type="button"
        role="radio"
        class="segment"
        data-index=${index}
        aria-checked=${selected ? "true" : "false"}
        title=${option.label}
        tabindex=${this.#tabIndexFor(index)}
        ?disabled=${this.disabled || option.disabled === true}
        @click=${() => this.#select(index)}
      >
        ${option.icon === undefined
          ? nothing
          : html`<jolly-icon name=${option.icon}></jolly-icon>`}
        <span class="segment-label">${option.label}</span>
      </button>
    `;
  }

  get #selectedIndex(): number {
    const current = this.concreteValue;
    if (current === undefined) {
      return -1;
    }

    return this.options.findIndex(
      (option) => this.valuesEqual(option.value, current)
    );
  }

  #tabIndexFor(
    index: number
  ): number {
    const selected = this.#selectedIndex;
    if (selected !== -1) {
      return selected === index ? 0 : -1;
    }

    const first = this.options.findIndex(
      (option) => option.disabled !== true
    );

    return first === index ? 0 : -1;
  }

  #onKeyDown(
    event: KeyboardEvent
  ): void {
    const step = arrowStep(event.key);
    if (step === kNoStep) {
      return;
    }

    const from = this.#selectedIndex === -1 ? 0 : this.#selectedIndex;
    const next = nextEnabledIndex(
      this.options.map((option) => option.disabled !== true),
      from,
      step
    );

    if (next === -1) {
      return;
    }

    event.preventDefault();
    this.#select(next);
    this.#focusSegment(next);
  }

  #focusSegment(
    index: number
  ): void {
    // Wait for the target's roving tabindex to render.
    void this.updateComplete.then(() => {
      const segment = this.renderRoot.querySelector(
        `.segment[data-index="${index}"]`
      );
      if (segment instanceof HTMLElement) {
        segment.focus();
      }
    });
  }

  #select(
    index: number
  ): void {
    const option = this.options[index];
    if (
      option === undefined ||
      option.disabled === true ||
      !this.editable
    ) {
      return;
    }

    this.emitChange(option.value);
  }
}

function arrowStep(
  key: string
): number {
  return kArrowSteps[key] ?? kNoStep;
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-button-group": ButtonGroup<unknown>;
  }
}
