// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import { JollyField } from "./JollyField.ts";
import { isInputElement } from "../dom.ts";

export abstract class BooleanField extends JollyField<boolean> {
  constructor() {
    super();

    this.value = false;
  }

  protected renderInput(): TemplateResult {
    return html`<input
      type="checkbox"
      .checked=${this.concreteValue ?? false}
      .indeterminate=${this.mixed}
      ?disabled=${this.disabled}
      aria-readonly=${this.readonlyAria}
      aria-disabled=${this.lockedAria}
      aria-description=${this.lockDescription}
      aria-invalid=${this.displayError === null ? nothing : "true"}
      @click=${this.#onClick}
    >`;
  }

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

    const next = this.mixed ? true : event.currentTarget.checked;
    this.emitChange(next);
  }
}
