// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import {
  AmbientThemeController,
  SubscriptionController,
  deepActiveElement,
  inputLayers,
  themeStyles
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/icon";

// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import type { VariableScript } from "../script/VariableScript.ts";
import { consoleStyles } from "./Console.styles.ts";
import type { ConsoleLogElement } from "./ConsoleLog.ts";
import "./ConsoleLog.ts";
import type { ConsoleScriptElement } from "./ConsoleScript.ts";
import "./ConsoleScript.ts";
import {
  KeyboardController,
  type ConsoleKeyAction,
  type KeyHint,
  type KeyState
} from "./KeyboardController.ts";
import { SuggestionController } from "./SuggestionController.ts";

// CONSTANTS
const kScriptHints: readonly KeyHint[] = [
  {
    keys: "Ctrl+S",
    action: "save"
  },
  {
    keys: "Esc",
    action: "cancel"
  }
];

@customElement("jolly-console")
export class ConsoleElement extends LitElement {
  static override styles = [
    themeStyles,
    consoleStyles
  ];

  @state()
  declare _text: string;

  @state()
  declare _caretAtEnd: boolean;

  @state()
  declare _script: VariableScript | null;

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

  @query("jolly-console-script")
  declare _scriptEditor: ConsoleScriptElement | null;

  #suggestions = new SuggestionController(this, {
    listbox: () => this._listbox,
    pick: (index) => this.#pick(index)
  });
  #keys = new KeyboardController(this, {
    state: () => this.#keyState(),
    act: (action) => this.#act(action),
    toggle: () => this.toggle()
  });
  #source = new SubscriptionController<CommandConsole>(
    this,
    (commands) => this.#watch(commands)
  );
  #restoreFocus: HTMLElement | null = null;
  #releaseLayer: (() => void) | null = null;
  #measuredText: string | null = null;
  #theme = new AmbientThemeController(this);

  constructor() {
    super();

    this._text = "";
    this._caretAtEnd = true;
    this._script = null;
  }

  get console(): CommandConsole | null {
    return this.#source.current;
  }

  set console(
    commands: CommandConsole
  ) {
    if (commands !== this.#source.current) {
      this.#suggestions.cancel();
      this.#source.attach(commands);
    }
  }

  get open(): boolean {
    return this._dialog?.open ?? false;
  }

  override disconnectedCallback(): void {
    this.#release();

    super.disconnectedCallback();
  }

  protected override updated(): void {
    const input = this._input;
    const ghost = this._ghost;
    if (
      input === null ||
      ghost === null ||
      ghost.hidden ||
      this.#measuredText === this._text
    ) {
      return;
    }

    this.#measuredText = this._text;
    const overflowing = input.scrollWidth > input.clientWidth;
    ghost.style.visibility = overflowing ? "hidden" : "";
  }

  async show(): Promise<void> {
    await this.updateComplete;
    const dialog = this._dialog;
    if (dialog === null || this.console === null) {
      return;
    }
    if (dialog.open) {
      (this._scriptEditor ?? this._input)?.focus();

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
    const classes = [
      "card",
      entries.length > 0 ? "has-log" : ""
    ].join(" ");
    const hints = this._script === null ? this.#keys.hints : kScriptHints;

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
            ${this._script === null ?
              this.#renderPrompt() :
              html`
                <jolly-console-script
                  .console=${this.console}
                  .script=${this._script}
                  @script-close=${this.#onScriptClose}
                ></jolly-console-script>
              `}
            <div class="keys">${hints.map(({ keys, action }) => html`
              <span class="key-hint"><kbd>${keys}</kbd>${action}</span>
            `)}</div>
          </div>
        </div>
      </dialog>
    `;
  }

  #renderPrompt(): TemplateResult {
    const suggestions = this.#suggestions;
    const expanded = suggestions.items.length > 0;
    const ghost = this.#ghostText();
    const usage = suggestions.usage;
    const scope = this.console?.scope.address ?? "";

    return html`
      <div class="prompt">
        <jolly-icon name="search" aria-hidden="true"></jolly-icon>
        <span
          class="scope"
          title=${scope}
          ?hidden=${scope === ""}
        >${scope}</span>
        <div class="field">
          <input
            type="text"
            role="combobox"
            aria-label=${scope === "" ? "Command" : `Command in ${scope}`}
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
          @scroll=${suggestions.onScroll}
        >${suggestions.renderOptions()}</ul>
      </div>
      <div id="usage" class="usage" ?hidden=${usage === null}>
        <span class="signature">${usage?.usage ?? ""}</span>
        <span class="description">${usage?.description ?? ""}</span>
      </div>
    `;
  }

  #watch(
    commands: CommandConsole
  ): Array<() => void> {
    return [
      commands.subscribe("registry-changed", () => {
        if (this.open) {
          this.#refresh();
        }
      }),
      commands.subscribe("scrollback-changed", () => this.requestUpdate()),
      commands.subscribe("scope-changed", () => {
        this.requestUpdate();
        if (this.open) {
          this.#refresh();
        }
      }),
      commands.subscribe("open-requested", () => void this.show()),
      commands.subscribe("close-requested", () => this.hide()),
      commands.subscribe("script-requested", (script) => void this.#editScript(script))
    ];
  }

  async #editScript(
    script: VariableScript
  ): Promise<void> {
    this._script = script;
    if (!this.open) {
      await this.show();
    }
    if (!this.open) {
      this._script = null;

      return;
    }
    await this.updateComplete;
    this._scriptEditor?.focus();
  }

  async #leaveScript(): Promise<void> {
    this._script = null;
    await this.updateComplete;
    this._input?.focus();
    this.#refresh();
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
      browsingHistory: this.console?.history.browsing ?? false,
      inlineCompletion: this.#ghostText() !== "",
      hasText: this._text.trim() !== "",
      hasHistory: (this.console?.history.size ?? 0) > 0,
      highlightRuns: suggestions.highlighted?.run ?? false
    };
  }

  #submit(
    line: string
  ): void {
    void this.console?.submit(line);
    void this.#replaceText("");
  }

  #accept(
    index: number,
    execute: boolean
  ): void {
    const item = this.#suggestions.items[index];
    if (item === undefined) {
      return;
    }

    if (item.run && execute) {
      this.#submit(item.text);
    }
    else {
      void this.#replaceText(item.text, item.caret);
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
          void this.#replaceText(recalled);
        }
        break;
      }
      case "highlight-previous":
      case "highlight-next":
        this.#suggestions.move(action === "highlight-next" ? 1 : -1);
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
      this.console?.history.stopBrowsing();
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
    if (this._script === null) {
      this.hide();
    }
    else {
      void this.#leaveScript();
    }
  };

  readonly #onBackdropClick = (
    event: MouseEvent
  ): void => {
    if (event.target === this._dialog && this._script === null) {
      this.hide();
    }
  };

  readonly #onScriptClose = (): void => {
    void this.#leaveScript();
  };

  readonly #onClose = (): void => {
    this._script = null;
    this.#theme.stop();
    this.#release();
    this.console?.history.stopBrowsing();
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
