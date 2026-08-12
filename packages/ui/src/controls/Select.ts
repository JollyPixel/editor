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
import { selectStyles } from "./Select.styles.ts";
import { isSelectElement } from "../dom.ts";
import { PointerFocusController } from "../field/PointerFocusController.ts";
import type { JollyOption } from "./types.ts";

// CONSTANTS
const kMixedValue = "__jolly_mixed__";

/**
 * Wraps a native select with index-based option matching.
 */
@customElement("jolly-select")
export class Select<TValue> extends JollyField<TValue> {
  static override styles = [
    ...JollyField.styles,
    selectStyles
  ];

  @property({ attribute: false })
  declare options: JollyOption<TValue>[];

  #pointerFocus = new PointerFocusController(this);

  constructor() {
    super();

    this.options = [];
  }

  protected renderValue(): TemplateResult {
    return html`
      <span class="select-wrap">
        <select
          ?disabled=${this.disabled}
          ?data-pointer-focus=${this.#pointerFocus.active}
          aria-readonly=${this.readonlyAria}
          aria-disabled=${this.lockedAria}
          aria-description=${this.lockDescription}
          aria-invalid=${this.displayError === null ? nothing : "true"}
          @focus=${this.#pointerFocus.onFocus}
          @blur=${this.#pointerFocus.onBlur}
          @keydown=${this.#pointerFocus.onKeyDown}
          @change=${this.#onChange}
        >
          ${this.mixed ? html`<option value=${kMixedValue}>—</option>` : nothing}
          ${this.options.map((option, index) => html`
            <option value=${String(index)} ?disabled=${option.disabled === true}>
              ${option.label}
            </option>
          `)}
        </select>
        <jolly-icon class="chevron" name="chevron"></jolly-icon>
      </span>
    `;
  }

  /**
   * Options render after the select's own bindings. Synchronizing here keeps
   * the native selected option aligned when options and value arrive together.
   */
  protected override updated(): void {
    const select = this.renderRoot.querySelector("select");
    if (select !== null) {
      select.value = this.#selectedKey;
    }
  }

  get #selectedKey(): string {
    const current = this.concreteValue;
    if (current === undefined) {
      return kMixedValue;
    }

    const index = this.options.findIndex(
      (option) => this.valuesEqual(option.value, current)
    );

    return index === -1 ? "" : String(index);
  }

  #onChange(
    event: Event
  ): void {
    if (!isSelectElement(event.target)) {
      return;
    }

    /*
     * Restore readonly selections while keeping the control focusable.
     */
    if (!this.editable) {
      event.target.value = this.#selectedKey;

      return;
    }

    const option = this.options[
      Number(event.target.value)
    ];
    if (option === undefined) {
      return;
    }

    this.emitChange(option.value);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-select": Select<unknown>;
  }
}
