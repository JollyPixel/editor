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
import { PointerFocusController } from "../field/PointerFocusController.ts";
import type { JollyChangeDetail } from "../field/events.ts";
import { emitComposedEvent } from "../events.ts";
import { preventDefault } from "../dom.ts";
import { referenceStyles } from "./Reference.styles.ts";

import "../icon/Icon.ts";

@customElement("jolly-reference")
export class Reference extends JollyField<string | null> {
  static override styles = [
    ...JollyField.styles,
    referenceStyles
  ];

  @property({ type: String })
  declare text: string;

  @property({ type: String })
  declare placeholder: string;

  #pointerFocus = new PointerFocusController(this);

  constructor() {
    super();

    this.text = "";
    this.placeholder = "<empty>";
    this.value = null;
  }

  protected renderValue(): TemplateResult {
    return html`
      <span class="reference">
        <span
          class="trigger"
          role="textbox"
          tabindex=${this.disabled ? "-1" : "0"}
          aria-label=${this.label === "" ? nothing : this.label}
          aria-readonly="true"
          aria-keyshortcuts=${this.#keyShortcuts}
          aria-disabled=${this.disabled ? "true" : this.lockedAria}
          aria-description=${this.lockDescription}
          aria-invalid=${this.displayError === null ? nothing : "true"}
          ?data-pointer-focus=${this.#pointerFocus.active}
          @focus=${this.#pointerFocus.onFocus}
          @blur=${this.#pointerFocus.onBlur}
          @keydown=${this.#onKeyDown}
          @dblclick=${this.#open}
        >
          <span class="trigger-label" ?data-empty=${this.#key === null}>
            ${this.#shown}
          </span>
        </span>
        <span class="actions">
          ${this.#clearable ?
            html`
              <button
                class="clear"
                type="button"
                tabindex="-1"
                aria-label="Clear"
                title="Clear"
                @pointerdown=${preventDefault}
                @click=${this.#clear}
              ><jolly-icon name="close" aria-hidden="true"></jolly-icon></button>
            ` :
            nothing}
          <button
            class="browse"
            type="button"
            tabindex="-1"
            aria-label="Browse"
            title="Browse"
            ?disabled=${!this.editable}
            @pointerdown=${preventDefault}
            @click=${this.#browse}
          ><jolly-icon name="folder" aria-hidden="true"></jolly-icon></button>
        </span>
      </span>
    `;
  }

  get #key(): string | null {
    return this.concreteValue ?? null;
  }

  get #clearable(): boolean {
    return this.editable && (this.mixed || this.#key !== null);
  }

  get #shown(): string {
    if (this.mixed) {
      return MIXED_PLACEHOLDER;
    }

    const key = this.#key;
    if (key === null) {
      return this.placeholder;
    }

    return this.text === "" ? key : this.text;
  }

  get #keyShortcuts(): string | typeof nothing {
    const keys: string[] = [];
    if (this.editable) {
      keys.push("Enter", "Space", "Delete", "Backspace");
    }
    if (!this.disabled && this.#key !== null) {
      keys.push("Alt+Enter");
    }

    return keys.length === 0 ? nothing : keys.join(" ");
  }

  #onKeyDown(
    event: KeyboardEvent
  ): void {
    this.#pointerFocus.onKeyDown();

    if (event.key === "Enter" && event.altKey) {
      event.preventDefault();
      this.#open();
    }
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.#browse();
    }
    else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      this.#clear();
    }
  }

  #browse(): void {
    if (!this.editable) {
      return;
    }

    emitComposedEvent<JollyChangeDetail<string | null>>(
      this,
      "jolly-browse",
      {
        value: this.#key
      }
    );
  }

  #clear(): void {
    if (this.#clearable) {
      this.emitChange(null);
    }
  }

  #open(): void {
    const key = this.#key;
    if (this.disabled || key === null) {
      return;
    }

    emitComposedEvent<JollyChangeDetail<string>>(
      this,
      "jolly-open",
      {
        value: key
      }
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-reference": Reference;
  }

  interface HTMLElementEventMap {
    "jolly-browse": CustomEvent<JollyChangeDetail<string | null>>;
    "jolly-open": CustomEvent<JollyChangeDetail<string>>;
  }
}
