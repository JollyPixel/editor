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
import {
  DraftController,
  type DraftResult
} from "./DraftController.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";
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
import type { CollaboratorPresence } from "../peer/types.ts";
import { resolveThemeToken } from "../theme/resolveThemeToken.ts";

// Registers the icon used by the revert gutter.
import "../icon/Icon.ts";

// CONSTANTS
const kMaxChips = 3;
const kWarned = new Set<string>();

/**
 * Which edge a field's value sits against. Logical, so it follows writing
 * direction rather than naming a physical side.
 */
export type FieldAlign = "start" | "end";

/**
 * `"top"` puts the label on its own line above the value, trading label/value
 * column alignment for more breathing room between rows.
 */
export type FieldLabelPosition = "inline" | "top";

export type { DraftResult } from "./DraftController.ts";

/**
 * Shared field chrome. Subclasses render only the value area.
 */
export abstract class JollyField<TValue> extends LitElement {
  static override styles = [
    fieldStyles,
    hiddenStyles
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

  /** Uses the theme accent for supported controls and the modified indicator. */
  @property({ type: Boolean, reflect: true })
  declare colored: boolean;

  /**
   * Numeric and monitor-style rows often read better against the trailing edge,
   * where the digits line up down the pane.
   */
  @property({ type: String, reflect: true })
  declare align: FieldAlign;

  @property({
    type: String,
    attribute: "label-position",
    reflect: true
  })
  declare labelPosition: FieldLabelPosition;

  #draft = new DraftController<TValue>(this);

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
    this.colored = false;
    this.align = "start";
    this.labelPosition = "inline";
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
    return this.#draft.draft;
  }

  /**
   * Keeps a focused draft ahead of incoming values.
   */
  protected setDraft(
    text: string | null
  ): void {
    this.#draft.setDraft(text);
  }

  protected setParseError(
    message: string | null
  ): void {
    this.#draft.setError(message);
  }

  /**
   * Clears the draft and parse error.
   */
  protected clearDraft(): void {
    this.#draft.clear();
  }

  /** Updates a text input draft and clears an earlier local parse error. */
  protected onDraftInput(
    event: Event
  ): void {
    this.#draft.onInput(event);
  }

  /** Handles the standard Enter and Escape draft lifecycle. */
  protected onDraftKeyDown(
    event: KeyboardEvent,
    commit: () => void
  ): void {
    this.#draft.onKeyDown(event, commit);
  }

  /** Commits a draft through a control-specific parser. */
  protected commitDraft(
    parse: (text: string) => DraftResult<TValue> | null
  ): void {
    this.#draft.commit(
      parse,
      this.editable,
      (value) => this.emitChange(value)
    );
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
    // Deferred: a field connected as part of a larger subtree insertion (the
    // common case when a scenario builds a whole panel off-document and
    // appends it in one shot) can run this before the browser has resolved
    // inherited custom properties for the batch, reading a false empty.
    queueMicrotask(() => this.#warnWhenUnscoped());
  }

  protected override willUpdate(): void {
    const holder = this.holder;

    this.toggleAttribute(
      "locked",
      holder !== null
    );
    this.toggleAttribute(
      "mixed",
      this.mixed
    );
    this.toggleAttribute(
      "modified",
      this.modified
    );
    this.toggleAttribute(
      "invalid",
      this.displayError !== null
    );
    this.toggleAttribute(
      "scrubbable",
      this.scrubbable
    );

    /* Exposes the lock color to host and subclass styles. */
    if (holder === null) {
      this.style.removeProperty(
        "--jolly-locked-ring"
      );
    }
    else {
      this.style.setProperty(
        "--jolly-locked-ring",
        holder.color
      );
    }
  }

  protected get displayError(): string | null {
    return this.#draft.error ?? this.error;
  }

  override render(): TemplateResult {
    return html`
      <div class="row">
        <div class="leading">
          ${this.#renderGutter()}
          ${this.label === "" ? nothing : html`<span class="label">${this.label}</span>`}
        </div>
        <div class="content">
          <div class="value">${this.renderValue()}</div>
          <div class="trailing">
            ${this.#renderRevert()}
            ${this.#renderPeers()}
          </div>
        </div>
      </div>
      ${this.#renderDescription()}
      ${this.#renderError()}
    `;
  }

  /**
   * Renders the lock affordance. The gutter collapses to nothing unless a
   * container opted its subtree in, so a single user pane pays no leading inset.
   */
  #renderGutter(): TemplateResult {
    const holder = this.holder;
    if (holder !== null) {
      return this.#renderLock(holder);
    }

    return html`<span class="gutter"></span>`;
  }

  /**
   * Renders a muted revert action at the trailing edge while the value differs
   * from its default.
   */
  #renderRevert(): TemplateResult | typeof nothing {
    if (!this.modified || !this.editable) {
      return nothing;
    }

    return html`
      <button
        class="revert"
        type="button"
        title="Revert to default"
        aria-label="Revert to default"
        @click=${this.#onRevert}
      ><jolly-icon name="revert"></jolly-icon></button>
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
    if (!this.isConnected) {
      return;
    }

    const tag = this.localName;
    if (kWarned.has(tag)) {
      return;
    }

    const resolved = resolveThemeToken(this, "--jolly-surface");

    if (resolved === "") {
      kWarned.add(tag);
      console.warn(
        `[jolly-pixel/ui] <${tag}> has no theme scope host above it, so most tokens ` +
        "resolve to nothing. Apply themeStyles to an ancestor shadow root."
      );
    }
  }
}
