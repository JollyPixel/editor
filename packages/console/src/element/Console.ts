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
  adoptAmbientTheme,
  deepActiveElement,
  inputLayers,
  themeStyles,
  type ResolvedThemeMode
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/icon";

// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import { classify } from "../input/classify.ts";
import type { ScrollbackEntry } from "../execution/Scrollback.ts";
import type { MatchRange } from "../search/score.ts";
import { consoleStyles } from "./Console.styles.ts";
import {
  isToggleShortcut,
  resolveKey,
  type ConsoleKeyAction
} from "./keymap.ts";
import {
  initialHighlight,
  moveHighlight
} from "./listNavigation.ts";
import {
  completionSuggestions,
  NO_SUGGESTIONS,
  searchSuggestions,
  type Suggestion,
  type SuggestionList
} from "./suggestions.ts";

// CONSTANTS
const kEntryIcons = {
  echo: "chevron",
  info: null,
  error: "warning"
} as const;

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
  declare _highlight: number;

  @query("dialog")
  declare _dialog: HTMLDialogElement | null;

  @query("input")
  declare _input: HTMLInputElement | null;

  @query(".scrollback")
  declare _scrollback: HTMLElement | null;

  #list: SuggestionList = NO_SUGGESTIONS;
  #request = 0;
  #browsingHistory = false;
  #restoreFocus: HTMLElement | null = null;
  #releaseLayer: (() => void) | null = null;
  #unsubscribe: (() => void) | null = null;
  #inheritedTheme: ResolvedThemeMode | null = null;

  constructor() {
    super();

    this.console = null;
    this._text = "";
    this._highlight = -1;
  }

  get open(): boolean {
    return this._dialog?.open ?? false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.#onWindowKeyDown, true);
  }

  override disconnectedCallback(): void {
    window.removeEventListener("keydown", this.#onWindowKeyDown, true);
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
    const scrollback = this._scrollback;
    if (scrollback !== null) {
      scrollback.scrollTop = scrollback.scrollHeight;
    }
    this.renderRoot
      .querySelector("[role=option][aria-selected=true]")
      ?.scrollIntoView({ block: "nearest" });
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
    this.#inheritedTheme = adoptAmbientTheme(this, this.#inheritedTheme);
    dialog.showModal();
    this.#releaseLayer = inputLayers.push({
      dismiss: () => {
        this.hide();

        return true;
      }
    });
    this.#refresh();
    this._input?.focus();
  }

  hide(): void {
    if (this._dialog?.open) {
      this._dialog.close();
    }
  }

  override render(): TemplateResult {
    const entries = this.console?.scrollback ?? [];
    const { items, hint } = this.#list;
    const expanded = items.length > 0;
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
          <div
            class="scrollback"
            role="log"
            aria-relevant="additions"
            aria-label="Console output"
            ?hidden=${entries.length === 0}
          >${entries.map((entry) => this.#renderEntry(entry))}</div>
          <div class="prompt">
            <jolly-icon name="search" aria-hidden="true"></jolly-icon>
            <input
              type="text"
              role="combobox"
              aria-label="Command"
              aria-autocomplete="list"
              aria-controls="suggestions"
              aria-expanded=${expanded ? "true" : "false"}
              aria-activedescendant=${this._highlight >= 0 && expanded ?
                `option-${this._highlight}` :
                nothing}
              autocomplete="off"
              spellcheck="false"
              placeholder="Search, /command or variable"
              .value=${live(this._text)}
              @input=${this.#onInput}
              @keydown=${this.#onKeyDown}
            >
            <span class="hint">${hint ?? ""}</span>
          </div>
          <ul
            id="suggestions"
            role="listbox"
            aria-label="Suggestions"
            ?hidden=${!expanded}
            @mousedown=${this.#onListMouseDown}
          >${items.map((item, index) => this.#renderSuggestion(item, index))}</ul>
        </div>
      </dialog>
    `;
  }

  #renderEntry(
    entry: ScrollbackEntry
  ): TemplateResult {
    const classes = [
      "entry",
      entry.kind,
      entry.pending ? "pending" : ""
    ].join(" ");
    const icon = kEntryIcons[entry.kind];

    return html`
      <div class=${classes}>
        ${icon === null ?
          nothing :
          html`<jolly-icon name=${icon} aria-hidden="true"></jolly-icon>`}
        <span class="text">${entry.text}</span>
      </div>
    `;
  }

  #renderSuggestion(
    item: Suggestion,
    index: number
  ): TemplateResult {
    const { match } = item;

    return html`
      <li
        id=${`option-${index}`}
        role="option"
        aria-selected=${index === this._highlight ? "true" : "false"}
        @click=${() => this.#pick(index)}
      >
        <span class="label">${match?.field === "label" ?
          marked(item.label, match.ranges) :
          item.label}</span>
        <span class="detail">${match?.field === "detail" ?
          marked(item.detail, match.ranges) :
          item.detail}</span>
      </li>
    `;
  }

  #bind(
    commands: CommandConsole | null
  ): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#request++;
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
    const commands = this.console;
    if (commands === null) {
      return;
    }

    const request = ++this.#request;
    const text = this._text;
    const classified = classify(text, commands.registry);
    if (classified.mode === "search") {
      this.#showList(searchSuggestions(classified.query, commands.registry));

      return;
    }

    this.#showList(this.#list.preselect ? NO_SUGGESTIONS : this.#list);
    const caret = this._input?.selectionStart ?? text.length;
    void completionSuggestions(text, caret, commands.registry).then((list) => {
      if (request === this.#request) {
        this.#showList(list);
      }
    });
  }

  #showList(
    list: SuggestionList
  ): void {
    this.#list = list;
    this._highlight = initialHighlight(list);
    this.requestUpdate();
  }

  async #replaceText(
    text: string,
    caret = text.length
  ): Promise<void> {
    this._text = text;
    await this.updateComplete;
    this._input?.setSelectionRange(caret, caret);
    this.#refresh();
  }

  #submit(
    line: string
  ): void {
    this.#browsingHistory = false;
    void this.console?.submit(line).then(() => this.#followAmbientTheme());
    void this.#replaceText("");
  }

  #followAmbientTheme(): void {
    const adopted = this.#inheritedTheme;
    if (adopted === null || this.getAttribute("theme") !== adopted) {
      return;
    }

    this.removeAttribute("theme");
    this.#inheritedTheme = adoptAmbientTheme(this, null);
    if (this.#inheritedTheme === null) {
      this.setAttribute("theme", adopted);
      this.#inheritedTheme = adopted;
    }
  }

  #accept(
    index: number,
    execute: boolean
  ): void {
    const item = this.#list.items[index];
    if (item === undefined) {
      return;
    }

    const { text, caret, run } = item.accept();
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
    this._highlight = index;
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
        this.#accept(this._highlight, true);
        break;
      case "complete":
        this.#accept(Math.max(this._highlight, 0), false);
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
        this._highlight = moveHighlight(
          this._highlight,
          action === "highlight-next" ? 1 : -1,
          this.#list
        );
        break;
      default:
        break;
    }
  }

  #release(): void {
    this.#releaseLayer?.();
    this.#releaseLayer = null;
  }

  readonly #onWindowKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (!isToggleShortcut(event) || this.console === null) {
      return;
    }

    event.preventDefault();
    if (this.open) {
      this.hide();
    }
    else {
      void this.show();
    }
  };

  readonly #onInput = (
    event: Event
  ): void => {
    if (event.target instanceof HTMLInputElement) {
      this._text = event.target.value;
      this.#browsingHistory = false;
      this.#refresh();
    }
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const action = resolveKey(event, {
      highlight: this._highlight,
      itemCount: this.#list.items.length,
      browsingHistory: this.#browsingHistory
    });
    if (action === null) {
      return;
    }

    event.preventDefault();
    this.#act(action);
  };

  readonly #onListMouseDown = (
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
    this.#release();
    this.#browsingHistory = false;
    this.#request++;
    this.#list = NO_SUGGESTIONS;
    this._text = "";
    this._highlight = -1;
    const restore = this.#restoreFocus;
    this.#restoreFocus = null;
    restore?.focus();
  };
}

function marked(
  text: string,
  ranges: MatchRange[]
): TemplateResult {
  const parts: (TemplateResult | string)[] = [];
  let cursor = 0;
  for (const { start, end } of ranges) {
    parts.push(text.slice(cursor, start));
    parts.push(html`<mark>${text.slice(start, end)}</mark>`);
    cursor = end;
  }
  parts.push(text.slice(cursor));

  return html`${parts}`;
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-console": ConsoleElement;
  }
}
