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
import { isInputElement } from "../dom.ts";
import { PointerFocusController } from "../field/PointerFocusController.ts";

@customElement("jolly-text")
export class Text extends JollyField<string> {
  @property({ type: String })
  declare placeholder: string;

  #pointerFocus = new PointerFocusController(this);

  constructor() {
    super();

    this.placeholder = "";
    this.value = "";
  }

  protected renderValue(): TemplateResult {
    return html`
      <input
        type="text"
        .value=${this.draftController.draft ?? this.#displayed}
        placeholder=${this.mixed ? MIXED_PLACEHOLDER : this.placeholder}
        ?disabled=${this.disabled}
        ?readonly=${this.inputReadonly}
        ?data-pointer-focus=${this.#pointerFocus.active}
        aria-readonly=${this.readonlyAria}
        aria-disabled=${this.lockedAria}
        aria-description=${this.lockDescription}
        aria-invalid=${this.displayError === null ? nothing : "true"}
        @input=${this.#onType}
        @focus=${this.#pointerFocus.onFocus}
        @keydown=${this.#onKeyDown}
        @blur=${this.#onBlur}
      >
    `;
  }

  get #displayed(): string {
    return this.concreteValue ?? "";
  }

  #onType(
    event: Event
  ): void {
    if (!isInputElement(event.target)) {
      return;
    }

    const { value } = event.target;

    this.draftController.updateDraft(value);
    this.emitInput(value);
  }

  #onKeyDown(
    event: KeyboardEvent
  ): void {
    this.#pointerFocus.onKeyDown();

    if (event.key === "Enter") {
      this.#commit();
    }
    else if (event.key === "Escape") {
      event.stopPropagation();
      this.draftController.clear();
    }
  }

  #onBlur(): void {
    this.#pointerFocus.onBlur();
    this.#commit();
  }

  #commit(): void {
    const { draft } = this.draftController;
    if (draft === null) {
      return;
    }

    if (
      draft === this.#displayed &&
      !this.mixed
    ) {
      this.draftController.clear();

      return;
    }

    this.emitChange(draft);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-text": Text;
  }
}
