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
  query
} from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import "@jolly-pixel/ui/icon";

// Import Internal Dependencies
import type { ScrollbackEntry } from "../execution/Scrollback.ts";
import { consoleLogStyles } from "./ConsoleLog.styles.ts";

// CONSTANTS
const kEntryIcons = {
  echo: "chevron",
  info: null,
  error: "warning"
} as const;
const kFoldedLines = 6;

@customElement("jolly-console-log")
export class ConsoleLogElement extends LitElement {
  static override styles = consoleLogStyles;

  @property({ attribute: false })
  declare entries: readonly ScrollbackEntry[];

  @query(".scrollback")
  declare _scrollback: HTMLElement | null;

  #unfolded = new Set<number>();
  #latest: number | null = null;
  #follow = true;
  #reveal: number | null = null;

  constructor() {
    super();

    this.entries = [];
  }

  followLatest(): void {
    this.#follow = true;
    this.requestUpdate();
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("entries")) {
      const latest = this.entries.at(-1)?.id ?? null;
      if (latest !== this.#latest) {
        this.#latest = latest;
        this.#follow = true;
      }
    }
  }

  protected override updated(): void {
    const scrollback = this._scrollback;
    if (scrollback === null) {
      return;
    }

    if (this.#follow) {
      scrollback.scrollTop = scrollback.scrollHeight;
      this.#follow = false;
    }
    scrollback
      .querySelector(`[data-entry="${this.#reveal}"]`)
      ?.scrollIntoView({ block: "nearest" });
    this.#reveal = null;
  }

  override render(): TemplateResult {
    return html`
      <div
        class="scrollback"
        role="log"
        aria-relevant="additions"
        aria-label="Console output"
      >${repeat(
        this.entries,
        (entry) => entry.id,
        (entry) => this.#renderEntry(entry)
      )}</div>
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
    const lines = entry.text.split("\n");
    const hiddenLines = lines.length > kFoldedLines + 1 ?
      lines.length - kFoldedLines :
      0;
    const unfolded = this.#unfolded.has(entry.id);
    const text = hiddenLines > 0 && !unfolded ?
      lines.slice(0, kFoldedLines).join("\n") :
      entry.text;

    return html`
      <div class=${classes} data-entry=${entry.id}>
        ${icon === null ?
          nothing :
          html`<jolly-icon name=${icon} aria-hidden="true"></jolly-icon>`}
        <span class="text">${text}${hiddenLines > 0 ?
          html`<button
            type="button"
            class="fold"
            aria-expanded=${unfolded ? "true" : "false"}
            @mousedown=${this.#keepFocus}
            @click=${() => this.#toggleFold(entry.id)}
          >${unfolded ? "Show less" : `Show ${hiddenLines} more lines`}</button>` :
          nothing}</span>
      </div>
    `;
  }

  #toggleFold(
    id: number
  ): void {
    if (!this.#unfolded.delete(id)) {
      this.#unfolded.add(id);
    }
    this.#reveal = id;
    this.requestUpdate();
  }

  readonly #keepFocus = (
    event: MouseEvent
  ): void => {
    event.preventDefault();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-console-log": ConsoleLogElement;
  }
}
