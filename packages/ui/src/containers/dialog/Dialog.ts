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
  query,
  state
} from "lit/decorators.js";

// Import Internal Dependencies
import { dialogStyles } from "./Dialog.styles.ts";
import {
  resolveDialogHeader,
  type DialogHeader,
  type DialogIntent
} from "./dialogHeader.ts";
import {
  resolveInlineConfirmation,
  type InlineConfirmation,
  type InlineConfirmOptions
} from "./inlineConfirm.ts";
import { emitContainerEvent } from "../events.ts";
import { deepActiveElement } from "../../dom.ts";
import "../../controls/Button.ts";
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

  @query(".confirmation [data-action=confirm]")
  declare _confirmAction: HTMLElement | null;

  @state()
  private declare _confirmation: InlineConfirmation | null;

  #settleConfirmation: ((confirmed: boolean) => void) | null = null;
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
    this._confirmation = null;
  }

  override disconnectedCallback(): void {
    this.#settleInlineConfirm(false);
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
    const confirmation = this._confirmation;

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
        <div class="body" ?inert=${confirmation !== null}><slot></slot></div>
        <footer class=${confirmation?.danger ? "danger" : ""}>
          <slot name="actions" ?hidden=${confirmation !== null}></slot>
          ${confirmation === null ?
            nothing :
            this.#renderConfirmation(confirmation)}
        </footer>
      </dialog>
    `;
  }

  #renderConfirmation(
    confirmation: InlineConfirmation
  ): TemplateResult {
    return html`
      <div class="confirmation" part="confirmation">
        <p class="message" role="alert">${confirmation.message}</p>
        <jolly-button
          data-action="cancel"
          @click=${() => this.#settleInlineConfirm(false)}
        >${confirmation.cancelLabel}</jolly-button>
        <jolly-button
          data-action="confirm"
          variant=${confirmation.variant}
          @click=${() => this.#settleInlineConfirm(true)}
        >${confirmation.confirmLabel}</jolly-button>
      </div>
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

  async confirmInline(
    options: InlineConfirmOptions
  ): Promise<boolean> {
    if (!this.open) {
      return false;
    }

    this.#settleInlineConfirm(false);

    const restoreFocus = deepActiveElement();
    const {
      promise,
      resolve
    } = Promise.withResolvers<boolean>();
    this.#settleConfirmation = resolve;
    this._confirmation = resolveInlineConfirmation(options);
    await this.updateComplete;
    this._confirmAction?.focus();

    const confirmed = await promise;
    await this.updateComplete;
    if (this.open && this._confirmation === null) {
      restoreFocus?.focus();
    }

    return confirmed;
  }

  #settleInlineConfirm(
    confirmed: boolean
  ): void {
    const settle = this.#settleConfirmation;
    if (settle === null) {
      return;
    }

    this.#settleConfirmation = null;
    this._confirmation = null;
    settle(confirmed);
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
    if (this._confirmation !== null) {
      return this._confirmAction;
    }

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
    if (this._confirmation !== null) {
      event.preventDefault();
      this.#settleInlineConfirm(false);

      return;
    }

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
    if (inside) {
      return;
    }

    if (this._confirmation !== null) {
      this.#settleInlineConfirm(false);

      return;
    }

    emitContainerEvent(
      this,
      "jolly-cancel",
      undefined
    );
    this.close();
  };

  #onBeforeToggle = (
    event: ToggleEvent
  ) => {
    if (event.newState === "closed") {
      this.#releaseLayer();
    }
  };

  #onClose = () => {
    this.#settleInlineConfirm(false);
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
