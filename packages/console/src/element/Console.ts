// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import {
  AmbientThemeController,
  deepActiveElement,
  inputLayers,
  themeStyles
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/icon";

// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import { consoleStyles } from "./Console.styles.ts";
import type { ConsoleLogElement } from "./ConsoleLog.ts";
import "./ConsoleLog.ts";
import {
  KeyboardController,
  type ConsoleKeyAction,
  type KeyState
} from "./KeyboardController.ts";
import { SuggestionController } from "./SuggestionController.ts";

@customElement("jolly-console")
export class ConsoleElement extends LitElement {
  static override styles = [
    themeStyles,
    consoleStyles
  ];

  @property({ attribute: false })
  declare console: CommandConsole | null;

  @state()
  declare _text: string;

  @state()
  declare _caretAtEnd: boolean;

  @query("dialog")
  declare _dialog: HTMLDialogElement | null;

  @query("input")
  declare _input: HTMLInputElement | null;

  @query(".ghost")
  declare _ghost: HTMLElement | null;

  @query("jolly-console-log")
  declare _log: ConsoleLogElement | null;

  @query("[role=listbox]")
  declare _listbox: HTMLElement | null;

  #suggestions = new SuggestionController(this, {
    listbox: () => this._listbox,
    pick: (index) => this.#pick(index)
  });
  #keys = new KeyboardController(this, {
    state: () => this.#keyState(),
    act: (action) => this.#act(action),
    toggle: () => this.toggle()
  });
  #browsingHistory = false;
  #restoreFocus: HTMLElement | null = null;
  #releaseLayer: (() => void) | null = null;
  #unsubscribe: (() => void) | null = null;
  #theme = new AmbientThemeController(this);

  constructor() {
    super();

    this.console = null;
    this._text = "";
    this._caretAtEnd = true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#bind(this.console);
  }

  get open(): boolean {
    return this._dialog?.open ?? false;
  }

  override disconnectedCallback(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#release();

    super.disconnectedCallback();
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("console")) {
      this.#bind(this.console);
    }
  }

  protected override updated(): void {
    const input = this._input;
    const ghost = this._ghost;
    if (input !== null && ghost !== null) {
      const overflowing = input.scrollWidth > input.clientWidth;
      ghost.style.visibility = overflowing ? "hidden" : "";
    }
  }

  async show(): Promise<void> {
    await this.updateComplete;
    const dialog = this._dialog;
    if (dialog === null || this.console === null) {
      return;
    }
    if (dialog.open) {
      this._input?.focus();

      return;
    }
    if (!inputLayers.dismissAll()) {
      return;
    }

    const active = deepActiveElement();
    this.#restoreFocus = active instanceof HTMLElement ? active : null;
    this.#theme.follow();
    this._text = "";
    dialog.showModal();
    this.#releaseLayer = inputLayers.push({
      dismiss: () => {
        this.hide();

        return true;
      }
    });
    this._log?.followLatest();
    this.#refresh();
    this._input?.focus();
    this.console.emit("opened");
  }

  hide(): void {
    if (this._dialog?.open) {
      this._dialog.close();
    }
  }

  toggle(): boolean {
    if (this.console === null) {
      return false;
    }

    if (this.open) {
      this.hide();
    }
    else {
      void this.show();
    }

    return true;
  }

  override render(): TemplateResult {
    const entries = this.console?.scrollback ?? [];
    const suggestions = this.#suggestions;
    const expanded = suggestions.items.length > 0;
    const ghost = this.#ghostText();
    const usage = suggestions.usage;
    const classes = [
      "card",
      entries.length > 0 ? "has-log" : ""
    ].join(" ");

    return html`
      <dialog
        aria-label="Console"
        @cancel=${this.#onCancel}
        @close=${this.#onClose}
        @click=${this.#onBackdropClick}
      >
        <div class=${classes}>
          <jolly-console-log
            .entries=${entries}
            ?hidden=${entries.length === 0}
          ></jolly-console-log>
          <div class="body">
            <div class="prompt">
              <jolly-icon name="search" aria-hidden="true"></jolly-icon>
              <div class="field">
                <input
                  type="text"
                  role="combobox"
                  aria-label="Command"
                  aria-autocomplete="both"
                  aria-controls="suggestions"
                  aria-expanded=${expanded ? "true" : "false"}
                  aria-activedescendant=${suggestions.highlight >= 0 && expanded ?
                    `option-${suggestions.highlight}` :
                    nothing}
                  aria-describedby=${usage === null ? nothing : "usage"}
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="Search, /command or variable"
                  .value=${live(this._text)}
                  @input=${this.#onInput}
                  @keydown=${this.#onKeyDown}
                  @keyup=${this.#onCaretMove}
                  @pointerup=${this.#onCaretMove}
                  @select=${this.#onCaretMove}
                >
                <span
                  class="ghost"
                  aria-hidden="true"
                  ?hidden=${ghost === ""}
                ><span class="typed">${this._text}</span><span
                  class="suffix"
                >${ghost}</span></span>
              </div>
              <span class="hint">${suggestions.hint ?? ""}</span>
            </div>
            <div class=${expanded ? "suggestions expanded" : "suggestions"}>
              <ul
                id="suggestions"
                role="listbox"
                aria-label="Suggestions"
                @mousedown=${this.#keepPromptFocus}
              >${suggestions.renderOptions()}</ul>
            </div>
            <div id="usage" class="usage" ?hidden=${usage === null}>
              <span class="signature">${usage?.usage ?? ""}</span>
              <span class="description">${usage?.description ?? ""}</span>
            </div>
            <div class="keys">${this.#keys.hints.map(({ keys, action }) => html`
              <span class="key-hint"><kbd>${keys}</kbd>${action}</span>
            `)}</div>
          </div>
        </div>
      </dialog>
    `;
  }

  #bind(
    commands: CommandConsole | null
  ): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#suggestions.cancel();
    if (commands === null) {
      return;
    }

    const onRegistryChanged = () => {
      if (this.open) {
        this.#refresh();
      }
    };
    const onScrollbackChanged = () => this.requestUpdate();
    const onOpen = () => void this.show();
    const onClose = () => this.hide();
    commands.on("registry-changed", onRegistryChanged);
    commands.on("scrollback-changed", onScrollbackChanged);
    commands.on("open-requested", onOpen);
    commands.on("close-requested", onClose);
    this.#unsubscribe = () => {
      commands.off("registry-changed", onRegistryChanged);
      commands.off("scrollback-changed", onScrollbackChanged);
      commands.off("open-requested", onOpen);
      commands.off("close-requested", onClose);
    };
  }

  #refresh(): void {
    if (this.console !== null) {
      const caret = this._input?.selectionStart ?? this._text.length;
      void this.#suggestions.refresh(this.console, this._text, caret);
    }
  }

  async #replaceText(
    text: string,
    caret = text.length
  ): Promise<void> {
    this._text = text;
    await this.updateComplete;
    this._input?.setSelectionRange(caret, caret);
    this.#syncCaret();
    this.#refresh();
  }

  #syncCaret(): void {
    const input = this._input;
    this._caretAtEnd = input === null || (
      input.selectionStart === input.selectionEnd &&
      input.selectionEnd === input.value.length
    );
  }

  #ghostText(): string {
    return this._caretAtEnd ?
      this.#suggestions.inlineCompletion(this._text) :
      "";
  }

  #keyState(): KeyState {
    const suggestions = this.#suggestions;

    return {
      highlight: suggestions.highlight,
      itemCount: suggestions.items.length,
      browsingHistory: this.#browsingHistory,
      inlineCompletion: this.#ghostText() !== "",
      hasText: this._text.trim() !== "",
      hasHistory: (this.console?.history.entries.length ?? 0) > 0,
      highlightRuns: suggestions.highlighted?.accept().run ?? false
    };
  }

  #submit(
    line: string
  ): void {
    this.#browsingHistory = false;
    void this.console?.submit(line);
    void this.#replaceText("");
  }

  #accept(
    index: number,
    execute: boolean
  ): void {
    const acceptance = this.#suggestions.accept(index);
    if (acceptance === null) {
      return;
    }

    const { text, caret, run } = acceptance;
    if (run && execute) {
      this.#submit(text);
    }
    else {
      void this.#replaceText(text, caret);
    }
  }

  #pick(
    index: number
  ): void {
    this.#accept(index, true);
    this._input?.focus();
  }

  #act(
    action: ConsoleKeyAction
  ): void {
    const commands = this.console;
    if (commands === null) {
      return;
    }

    switch (action) {
      case "close":
        this.hide();
        break;
      case "submit":
        if (this._text.trim() !== "") {
          this.#submit(this._text);
        }
        break;
      case "accept":
        this.#accept(this.#suggestions.highlight, true);
        break;
      case "complete":
        this.#accept(Math.max(this.#suggestions.highlight, 0), false);
        break;
      case "history-previous":
      case "history-next": {
        const recalled = action === "history-previous" ?
          commands.history.previous(this._text) :
          commands.history.next();
        if (recalled !== null) {
          this.#browsingHistory = true;
          void this.#replaceText(recalled);
        }
        break;
      }
      case "highlight-previous":
      case "highlight-next":
        this.#suggestions.move(action === "highlight-next" ? 1 : -1);
        break;
      default:
        break;
    }
  }

  #release(): void {
    this.#releaseLayer?.();
    this.#releaseLayer = null;
  }

  readonly #onInput = (
    event: Event
  ): void => {
    if (event.target instanceof HTMLInputElement) {
      this._text = event.target.value;
      this.#browsingHistory = false;
      this.#syncCaret();
      this.#refresh();
    }
  };

  readonly #onCaretMove = (): void => {
    this.#syncCaret();
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    this.#syncCaret();
    this.#keys.onKeyDown(event);
  };

  readonly #keepPromptFocus = (
    event: MouseEvent
  ): void => {
    event.preventDefault();
  };

  readonly #onCancel = (
    event: Event
  ): void => {
    event.preventDefault();
    this.hide();
  };

  readonly #onBackdropClick = (
    event: MouseEvent
  ): void => {
    if (event.target === this._dialog) {
      this.hide();
    }
  };

  readonly #onClose = (): void => {
    this.#theme.stop();
    this.#release();
    this.#browsingHistory = false;
    this.#suggestions.cancel();
    const restore = this.#restoreFocus;
    this.#restoreFocus = null;
    restore?.focus();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-console": ConsoleElement;
  }
}
