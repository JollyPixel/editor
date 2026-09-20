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
import {
  resolveDialogHeader,
  type DialogHeader,
  type DialogIntent
} from "./dialogHeader.ts";
import { emitContainerEvent } from "../events.ts";
import "../../icon/Icon.ts";
import type {
  IconName,
  IconTone
} from "../../icon/registry.ts";
import { applyAreaTone } from "../../theme/areaTone.ts";
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

  @property({ type: String })
  declare icon: IconName;

  @property({ type: String, reflect: true })
  declare tone: IconTone | "";

  @property({ type: String, reflect: true })
  declare intent: DialogIntent | "";

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

  #header: DialogHeader = resolveDialogHeader({
    icon: "",
    tone: "",
    intent: ""
  });
  #inheritedTheme: ResolvedThemeMode | null = null;
  #releaseInputLayer: (() => void) | null = null;

  constructor() {
    super();

    this.heading = "";
    this.icon = "";
    this.tone = "";
    this.intent = "";
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

  protected override willUpdate(
    changed: Map<PropertyKey, unknown>
  ): void {
    if (
      changed.has("icon") ||
      changed.has("tone") ||
      changed.has("intent")
    ) {
      this.#header = resolveDialogHeader({
        icon: this.icon,
        tone: this.tone,
        intent: this.intent
      });
      applyAreaTone(this, this.#header.tone);
    }
  }

  override render(): TemplateResult {
    const labelled = this.heading !== "" && !this.headingEditable;

    return html`
      <dialog
        class="overlay-motion"
        role=${this.#header.alert ? "alertdialog" : nothing}
        aria-labelledby=${labelled ? "title" : nothing}
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
    const { icon } = this.#header;
    if (
      this.heading === "" &&
      !this.headingEditable &&
      icon === ""
    ) {
      return nothing;
    }

    const glyph = icon === ""
      ? nothing
      : html`
        <jolly-icon
          class="icon"
          part="icon"
          name=${icon}
          on-fill
          aria-hidden="true"
        ></jolly-icon>
      `;

    if (!this.headingEditable) {
      return html`
        <header part="header">
          ${glyph}
          <span id="title" class="title" part="title">${this.heading}</span>
        </header>
      `;
    }

    return html`
      <header part="header">
        ${glyph}
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
