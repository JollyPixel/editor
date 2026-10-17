// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";

// Import Internal Dependencies
import { searchStyles } from "./Search.styles.ts";
import { emitFieldEvent } from "../field/events.ts";
import {
  isInputElement,
  preventDefault
} from "../dom.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

import "../icon/Icon.ts";

@customElement("jolly-search")
export class Search extends LitElement {
  static override shadowRootOptions = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true
  };

  static override styles = [
    searchStyles,
    hiddenStyles
  ];

  @property({ type: String })
  declare value: string;

  @property({ type: String })
  declare placeholder: string;

  @property({ type: String })
  declare label: string;

  @property({ type: Boolean, reflect: true })
  declare compact: boolean;

  @property({ type: Boolean, reflect: true })
  declare expanded: boolean;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @query("input")
  declare _input: HTMLInputElement | null;

  @query(".trigger")
  declare _trigger: HTMLButtonElement | null;

  constructor() {
    super();

    this.value = "";
    this.placeholder = "Search";
    this.label = "Search";
    this.compact = false;
    this.expanded = false;
    this.disabled = false;
  }

  get collapsed(): boolean {
    return this.compact && !this.expanded;
  }

  async open(): Promise<void> {
    this.expanded = true;
    await this.updateComplete;
    this._input?.focus();
    this._input?.select();
  }

  clear(): void {
    if (this.value === "") {
      return;
    }

    this.value = "";
    emitFieldEvent(this, "jolly-input", this.value);
    emitFieldEvent(this, "jolly-change", this.value);
  }

  override render(): TemplateResult {
    if (this.collapsed) {
      return html`
        <button
          class="trigger"
          part="trigger"
          type="button"
          aria-label=${this.label}
          title=${this.label}
          ?disabled=${this.disabled}
          @click=${this.open}
        ><jolly-icon name="search" aria-hidden="true"></jolly-icon></button>
      `;
    }

    return html`
      <div class="box" part="box">
        <jolly-icon
          class="glyph"
          name="search"
          aria-hidden="true"
        ></jolly-icon>
        <input
          type="text"
          role="searchbox"
          enterkeyhint="search"
          autocomplete="off"
          spellcheck="false"
          .value=${this.value}
          placeholder=${this.placeholder}
          aria-label=${this.label}
          ?disabled=${this.disabled}
          @input=${this.#onInput}
          @keydown=${this.#onKeyDown}
          @blur=${this.#onBlur}
        >
        <button
          class="clear"
          type="button"
          tabindex="-1"
          aria-label="Clear search"
          ?hidden=${this.value === ""}
          @pointerdown=${preventDefault}
          @click=${this.#onClear}
        ><jolly-icon name="close" aria-hidden="true"></jolly-icon></button>
      </div>
    `;
  }

  #onInput = (
    event: Event
  ) => {
    if (isInputElement(event.target)) {
      this.value = event.target.value;
      emitFieldEvent(this, "jolly-input", this.value);
    }
  };

  #onKeyDown = (
    event: KeyboardEvent
  ) => {
    if (event.key === "Enter") {
      emitFieldEvent(this, "jolly-change", this.value);

      return;
    }
    if (event.key !== "Escape") {
      return;
    }

    if (this.value !== "") {
      event.preventDefault();
      event.stopPropagation();
      this.clear();
    }
    else if (this.compact) {
      event.preventDefault();
      event.stopPropagation();
      void this.#collapse();
    }
  };

  #onBlur = () => {
    if (this.compact && this.value === "") {
      this.expanded = false;
    }
  };

  #onClear = () => {
    this.clear();
    this._input?.focus();
  };

  async #collapse(): Promise<void> {
    this.expanded = false;
    await this.updateComplete;
    this._trigger?.focus();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-search": Search;
  }
}
