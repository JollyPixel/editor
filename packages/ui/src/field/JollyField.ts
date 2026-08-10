// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { property } from "lit/decorators.js";

// Import Internal Dependencies
import { fieldStyles } from "./JollyField.styles.ts";
import { emitFieldEvent } from "./events.ts";
import {
  isModified,
  resolveHolder,
  splitPeerChips
} from "./predicates.ts";
import {
  isMixed,
  type FieldValue
} from "./mixed.ts";
import type { CollaboratorPresence } from "../collab/types.ts";

// Registers the icon used by the revert gutter.
import "../icon/Icon.ts";

// CONSTANTS
const kMaxChips = 3;
const kWarned = new Set<string>();

/**
 * Shared field chrome. Subclasses render only the value area.
 */
export abstract class JollyField<TValue> extends LitElement {
  static override styles = [
    fieldStyles
  ];

  @property({ type: String })
  declare label: string;

  @property({ type: String })
  declare description: string;

  @property({ attribute: false })
  declare value: FieldValue<TValue>;

  @property({ attribute: false })
  declare default: TValue | undefined;

  @property({ attribute: false })
  declare lockedBy: CollaboratorPresence | null;

  @property({ attribute: false })
  declare peers: CollaboratorPresence[];

  @property({ type: String })
  declare error: string | null;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @property({ type: Boolean, reflect: true })
  declare readonly: boolean;

  #draft: string | null = null;
  #parseError: string | null = null;

  constructor() {
    super();

    this.label = "";
    this.description = "";
    this.default = undefined;
    this.lockedBy = null;
    this.peers = [];
    this.error = null;
    this.disabled = false;
    this.readonly = false;
  }

  /**
   * Renders the control's value area.
   */
  protected abstract renderValue(): TemplateResult;

  /**
   * Numeric controls opt in to label scrubbing.
   */
  protected get scrubbable(): boolean {
    return false;
  }

  /**
   * Compares values for the revert state.
   */
  protected valuesEqual(
    a: TValue,
    b: TValue
  ): boolean {
    return Object.is(a, b);
  }

  protected get modified(): boolean {
    return isModified(
      this.value,
      this.default,
      (a, b) => this.valuesEqual(a, b)
    );
  }

  protected get editable(): boolean {
    return !this.disabled && !this.readonly && this.lockedBy === null;
  }

  protected get mixed(): boolean {
    return isMixed(this.value);
  }

  /**
   * `undefined` for a mixed value.
   */
  protected get concreteValue(): TValue | undefined {
    return isMixed(
      this.value
    ) ? undefined : this.value;
  }

  protected get draft(): string | null {
    return this.#draft;
  }

  /**
   * Keeps a focused draft ahead of incoming values.
   */
  protected setDraft(
    text: string | null
  ): void {
    if (this.#draft === text) {
      return;
    }

    this.#draft = text;
    this.requestUpdate();
  }

  protected setParseError(
    message: string | null
  ): void {
    if (this.#parseError === message) {
      return;
    }

    this.#parseError = message;
    this.requestUpdate();
  }

  /**
   * Clears the draft and parse error.
   */
  protected clearDraft(): void {
    this.setDraft(null);
    this.setParseError(null);
  }

  protected emitInput(
    value: TValue
  ): void {
    emitFieldEvent(
      this,
      "jolly-input",
      value
    );
  }

  /**
   * Emits a committed value after clearing the draft.
   */
  protected emitChange(
    value: TValue
  ): void {
    this.clearDraft();
    emitFieldEvent(
      this,
      "jolly-change",
      value
    );
  }

  protected get inputReadonly(): boolean {
    return this.readonly || this.lockedBy !== null;
  }

  /**
   * Avoids the ARIAMixin `ariaReadOnly` member.
   */
  protected get readonlyAria(): "true" | typeof nothing {
    return this.readonly ? "true" : nothing;
  }

  protected get lockedAria(): "true" | typeof nothing {
    return this.lockedBy === null ? nothing : "true";
  }

  protected get lockDescription(): string | typeof nothing {
    return this.lockedBy === null
      ? nothing
      : `Held by ${this.lockedBy.displayName}`;
  }

  /**
   * Current lock holder.
   */
  protected get holder(): CollaboratorPresence | null {
    return resolveHolder(this.peers, this.lockedBy);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#warnWhenUnscoped();
  }

  protected override willUpdate(): void {
    const holder = this.holder;

    this.toggleAttribute("locked", holder !== null);
    this.toggleAttribute("mixed", this.mixed);
    this.toggleAttribute(
      "modified",
      this.modified
    );
    this.toggleAttribute("invalid", this.displayError !== null);
    this.toggleAttribute("scrubbable", this.scrubbable);

    /* Exposes the lock color to host and subclass styles. */
    if (holder === null) {
      this.style.removeProperty("--jolly-locked-ring");
    }
    else {
      this.style.setProperty("--jolly-locked-ring", holder.color);
    }
  }

  protected get displayError(): string | null {
    return this.#parseError ?? this.error;
  }

  override render(): TemplateResult {
    return html`
      <div class="row">
        ${this.#renderGutter()}
        ${this.label === "" ? nothing : html`<span class="label">${this.label}</span>`}
        <div class="value">${this.renderValue()}</div>
        ${this.#renderPeers()}
      </div>
      ${this.#renderDescription()}
      ${this.#renderError()}
    `;
  }

  /**
   * Renders the lock or revert affordance in a fixed-width gutter.
   */
  #renderGutter(): TemplateResult {
    const holder = this.holder;
    if (holder !== null) {
      return this.#renderLock(holder);
    }

    const modified = this.modified;
    if (!modified || !this.editable) {
      return html`<span class="gutter"></span>`;
    }

    return html`
      <span class="gutter">
        <button
          class="revert"
          type="button"
          title="Revert to default"
          aria-label="Revert to default"
          @click=${this.#onRevert}
        ><jolly-icon name="revert"></jolly-icon></button>
      </span>
    `;
  }

  #onRevert(): void {
    if (this.default === undefined) {
      return;
    }

    this.emitChange(this.default);
  }

  /**
   * Renders the lock indicator with its holder tooltip.
   */
  #renderLock(
    holder: CollaboratorPresence
  ): TemplateResult {
    const label = `Held by ${holder.displayName}`;

    return html`
      <span class="gutter" data-tooltip=${label}>
        <jolly-icon name="lock" label=${label}></jolly-icon>
      </span>
    `;
  }

  #renderPeers(): TemplateResult | typeof nothing {
    if (this.peers.length === 0) {
      return nothing;
    }

    const {
      shown,
      overflow
    } = splitPeerChips(this.peers, kMaxChips);

    return html`
      <span class="peers">
        ${shown.map((peer) => html`
          <span
            class="chip"
            role="img"
            aria-label=${peer.displayName}
            data-tooltip=${peer.displayName}
            style="background: ${peer.color}; --jolly-peer-color: ${peer.color}"
          ></span>
        `)}
        ${overflow === 0 ? nothing : html`<span class="overflow">+${overflow}</span>`}
      </span>
    `;
  }

  /**
   * Renders a semantic icon beside help or error text.
   */
  #renderDescription(): TemplateResult | typeof nothing {
    return this.description === ""
      ? nothing
      : html`
        <p class="description">
          <jolly-icon name="info"></jolly-icon>
          <span>${this.description}</span>
        </p>
      `;
  }

  #renderError(): TemplateResult | typeof nothing {
    const message = this.displayError;

    return message === null
      ? nothing
      : html`
        <p class="error" role="alert">
          <jolly-icon name="warning"></jolly-icon>
          <span>${message}</span>
        </p>
      `;
  }

  /**
   * Warns when a field is rendered outside a theme scope.
   */
  #warnWhenUnscoped(): void {
    const tag = this.localName;
    if (kWarned.has(tag)) {
      return;
    }

    const resolved = getComputedStyle(this)
      .getPropertyValue("--jolly-surface")
      .trim();

    if (resolved === "") {
      kWarned.add(tag);
      console.warn(
        `[jolly-pixel/ui] <${tag}> has no theme scope host above it, so most tokens ` +
        "resolve to nothing. Apply themeStyles to an ancestor shadow root."
      );
    }
  }
}
