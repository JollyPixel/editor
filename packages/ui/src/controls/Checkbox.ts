// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import { JollyField } from "../field/JollyField.ts";
import { checkboxStyles } from "./Checkbox.styles.ts";
import { isInputElement } from "../dom.ts";

/**
 * Wraps a native checkbox and its indeterminate state.
 */
@customElement("jolly-checkbox")
export class Checkbox extends JollyField<boolean> {
  static override styles = [
    ...JollyField.styles,
    checkboxStyles
  ];

  constructor() {
    super();

    this.value = false;
  }

  /** Keeps the native checkbox on the standard control-sized hit target. */
  protected renderValue(): TemplateResult {
    return html`
      <span class="checkbox">
        <input
          type="checkbox"
          .checked=${this.concreteValue ?? false}
          .indeterminate=${this.mixed}
          ?disabled=${this.disabled}
          aria-readonly=${this.readonlyAria}
          aria-disabled=${this.lockedAria}
          aria-description=${this.lockDescription}
          aria-invalid=${this.displayError === null ? nothing : "true"}
          @click=${this.#onClick}
        >
      </span>
    `;
  }

  /**
   * Cancel clicks on readonly controls without removing them from tab order.
   */
  #onClick(
    event: MouseEvent
  ): void {
    if (
      !this.editable ||
      !isInputElement(event.currentTarget)
    ) {
      event.preventDefault();

      return;
    }

    /*
     * Native activation has already updated `checked` before this handler runs.
     */
    const next = this.mixed ? true : event.currentTarget.checked;
    this.emitChange(next);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-checkbox": Checkbox;
  }
}
