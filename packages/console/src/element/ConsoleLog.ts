// Import Third-party Dependencies
import {
  LitElement,
  css,
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

// CONSTANTS
const kEntryIcons = {
  echo: "chevron",
  info: null,
  error: "warning"
} as const;
const kFoldedLines = 6;

@customElement("jolly-console-log")
export class ConsoleLogElement extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: absolute;
      right: 0;
      bottom: 100%;
      left: 0;
    }

    :host([hidden]) {
      display: none;
    }

    .scrollback {
      max-height: min(
        calc(var(--jolly-console-row) * 8),
        calc(var(--jolly-console-top) - 16px)
      );
      overflow-y: auto;
      padding: var(--jolly-space-1, 4px) 0;
      border-bottom: 1px solid var(--jolly-divider, rgb(255 255 255 / 8%));
      border-radius: var(--jolly-console-radius, 4px) var(--jolly-console-radius, 4px) 0 0;
      background: var(--jolly-console-bg);
      box-shadow: var(--jolly-console-shadow);
      transition: opacity var(--jolly-duration-base, 160ms) var(--jolly-easing, ease);
      scrollbar-color: var(--jolly-groove, rgb(255 255 255 / 20%)) transparent;
      scrollbar-width: thin;
    }

    @starting-style {
      .scrollback {
        opacity: 0;
      }
    }

    .entry {
      display: flex;
      gap: var(--jolly-space-2, 8px);
      align-items: baseline;
      min-height: var(--jolly-console-row);
      padding: 2px var(--jolly-space-3, 12px);
      box-sizing: border-box;
      transition:
        opacity var(--jolly-duration-base, 160ms) var(--jolly-easing, ease),
        transform var(--jolly-duration-base, 160ms) var(--jolly-easing, ease);
    }

    @starting-style {
      .entry {
        opacity: 0;
        transform: translateY(4px);
      }
    }

    .text {
      flex: 1 1 auto;
      min-width: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    jolly-icon {
      flex: 0 0 auto;
      align-self: center;

      --jolly-icon-size: 10px;
    }

    .info {
      padding-inline-start: calc(var(--jolly-space-3, 12px) + 18px);
    }

    .echo {
      color: var(--jolly-text-muted, #9aa0a6);
    }

    .error {
      color: var(--jolly-danger, #ff6b6b);
    }

    .pending {
      color: var(--jolly-text-muted, #9aa0a6);
      animation: pending 1s ease-in-out infinite alternate;
    }

    @keyframes pending {
      from {
        opacity: 1;
      }

      to {
        opacity: 0.3;
      }
    }

    .fold {
      display: block;
      margin-top: 2px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--jolly-accent-text, #7aa7ff);
      font: inherit;
      cursor: pointer;
    }

    .fold:hover {
      text-decoration: underline;
    }

    .fold:focus-visible {
      outline: 1px solid var(--jolly-focus-ring, #3b82f6);
      outline-offset: 1px;
    }

    @media (prefers-reduced-motion: reduce) {
      .scrollback,
      .entry {
        transition: none;
      }

      .pending {
        animation: none;
      }
    }
  `;

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
