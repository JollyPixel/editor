// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";

// Import Internal Dependencies
import { dialogStyles } from "./Dialog.styles.ts";
import { emitContainerEvent } from "../events.ts";
import { themeStyles } from "../../theme/styles/themeStyles.ts";
import {
  ambientThemeMode,
  type ResolvedThemeMode
} from "../../theme/ambientTheme.ts";
import { inputLayers } from "../../interaction/input/InputLayers.ts";

// CONSTANTS
const kDefaultVariants = new Set(["accent", "danger"]);

@customElement("jolly-dialog")
export class Dialog extends LitElement {
  static override styles = [
    themeStyles,
    dialogStyles
  ];

  @property({ type: String })
  declare heading: string;

  @property({ type: Boolean })
  declare dismissible: boolean;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "heading-editable"
  })
  declare headingEditable: boolean;

  @query("dialog")
  declare _dialog: HTMLDialogElement;

  @query("slot[name=actions]")
  declare _actions: HTMLSlotElement;

  #inheritedTheme: ResolvedThemeMode | null = null;
  #releaseInputLayer: (() => void) | null = null;

  constructor() {
    super();

    this.heading = "";
    this.dismissible = true;
    this.headingEditable = false;
  }

  override disconnectedCallback(): void {
    this.#releaseLayer();

    super.disconnectedCallback();
  }

  get open(): boolean {
    return this._dialog?.open ?? false;
  }

  override render(): TemplateResult {
    return html`
      <dialog
        class="overlay-motion"
        tabindex=${this.headingEditable ? "-1" : nothing}
        @beforetoggle=${this.#onBeforeToggle}
        @cancel=${this.#onCancel}
        @click=${this.#onBackdropClick}
        @close=${this.#onClose}
        @keydown=${this.#onKeyDown}
      >
        ${this.#renderHeader()}
        <div class="body"><slot></slot></div>
        <footer><slot name="actions"></slot></footer>
      </dialog>
    `;
  }

  #renderHeader(): TemplateResult | typeof nothing {
    if (this.heading === "" && !this.headingEditable) {
      return nothing;
    }

    if (!this.headingEditable) {
      return html`<header>${this.heading}</header>`;
    }

    return html`
      <header>
        <input
          class="heading"
          type="text"
          aria-label="Title"
          .value=${this.heading}
          @blur=${this.#onHeadingBlur}
          @keydown=${this.#onHeadingKeyDown}
        >
      </header>
    `;
  }

  async showModal(): Promise<void> {
    this.#syncInheritedTheme();
    await this.updateComplete;
    if (!this._dialog.open) {
      this._dialog.showModal();
      if (this.headingEditable) {
        this._dialog.focus();
      }
      this.#releaseInputLayer ??= inputLayers.push();
    }
  }

  #releaseLayer(): void {
    this.#releaseInputLayer?.();
    this.#releaseInputLayer = null;
  }

  close(
    returnValue = ""
  ): void {
    if (this._dialog?.open) {
      this._dialog.close(returnValue);
    }
  }

  #syncInheritedTheme(): void {
    const configured = this.getAttribute("theme");
    if (
      configured !== null &&
      configured !== this.#inheritedTheme
    ) {
      return;
    }

    const inherited = ambientThemeMode(this);
    if (inherited === null) {
      return;
    }

    this.#inheritedTheme = inherited;
    this.setAttribute("theme", inherited);
  }

  #defaultAction(): HTMLElement | null {
    const actions = (this._actions?.assignedElements() ?? [])
      .filter((element) => element instanceof HTMLElement);
    const candidate = actions.find(
      (element) => element.hasAttribute("data-default")
    ) ?? actions.findLast(
      (element) => kDefaultVariants.has(element.getAttribute("variant") ?? "")
    );
    if (candidate === undefined || isDisabled(candidate)) {
      return null;
    }

    return candidate;
  }

  #onKeyDown = (
    event: KeyboardEvent
  ) => {
    if (
      event.key !== "Enter" ||
      event.defaultPrevented ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      consumesEnter(event)
    ) {
      return;
    }

    const action = this.#defaultAction();
    if (action === null) {
      return;
    }

    event.preventDefault();
    action.click();
  };

  #onHeadingKeyDown = (
    event: KeyboardEvent
  ) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      input.value = this.heading;
    }
    else if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      this.#commitHeading(input.value);
    }
  };

  #onHeadingBlur = (
    event: FocusEvent
  ) => {
    if (event.target instanceof HTMLInputElement) {
      this.#commitHeading(event.target.value);
    }
  };

  #commitHeading(
    draft: string
  ): void {
    const heading = draft.trim();
    if (heading === "" || heading === this.heading) {
      return;
    }

    emitContainerEvent(this, "jolly-heading-change", { heading });
  }

  #onCancel = (
    event: Event
  ) => {
    if (!this.dismissible) {
      event.preventDefault();

      return;
    }

    emitContainerEvent(
      this,
      "jolly-cancel",
      undefined
    );
  };

  #onBackdropClick = (
    event: MouseEvent
  ) => {
    if (
      !this.dismissible ||
      event.target !== this._dialog
    ) {
      return;
    }

    const rect = this._dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) {
      emitContainerEvent(
        this,
        "jolly-cancel",
        undefined
      );
      this.close();
    }
  };

  #onBeforeToggle = (
    event: ToggleEvent
  ) => {
    if (event.newState === "closed") {
      this.#releaseLayer();
    }
  };

  #onClose = () => {
    this.#releaseLayer();
    emitContainerEvent(this, "jolly-close", {
      returnValue: this._dialog.returnValue
    });
  };
}

function consumesEnter(
  event: KeyboardEvent
): boolean {
  const [source] = event.composedPath();
  if (!(source instanceof HTMLElement)) {
    return false;
  }

  return source instanceof HTMLButtonElement ||
    source instanceof HTMLTextAreaElement ||
    source instanceof HTMLAnchorElement ||
    source.isContentEditable;
}

function isDisabled(
  element: HTMLElement
): boolean {
  return element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true";
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-dialog": Dialog;
  }
}
