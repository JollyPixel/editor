// Import Third-party Dependencies
import {
  css,
  html,
  nothing,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import { styleMap } from "lit/directives/style-map.js";

// Import Internal Dependencies
import type { CodeAssistant } from "../../language/CodeAssistant.ts";
import { LatestQuestion } from "../../language/LatestQuestion.ts";
import {
  CompletionList,
  type AcceptedCompletion
} from "./CompletionList.ts";
import type { CodeLayout } from "./CodeViewport.ts";

export interface CompletionPopupSources {
  readonly assistant: CodeAssistant;
  text(): string;
  caret(): number | null;
  accept(accepted: AcceptedCompletion): void;
}

// CONSTANTS
const kTrigger = /^[\p{ID_Continue}$.]$/u;
const kVisibleCompletions = 10;

export const COMPLETION_STYLES = css`
  .completions {
    position: absolute;
    z-index: 3;
    min-width: 24ch;
    max-width: 60ch;
    padding: 2px 0;
    border: 1px solid var(--jolly-border);
    border-radius: var(--jolly-radius-sm);
    color: var(--jolly-text);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-floating);
  }

  .completion {
    display: flex;
    gap: 2ch;
    padding: 0 8px;
    cursor: pointer;
  }

  .completion.selected {
    background: color-mix(in srgb, var(--jolly-accent-500) 30%, transparent);
  }

  .completion-kind {
    margin-inline-start: auto;
    color: var(--jolly-text-muted);
    font-family: var(--jolly-font-family);
    font-size: 11px;
  }
`;

export class CompletionPopup {
  #host: ReactiveControllerHost;
  #sources: CompletionPopupSources;
  #question: LatestQuestion;
  #list: CompletionList | null = null;

  constructor(
    host: ReactiveControllerHost,
    sources: CompletionPopupSources
  ) {
    this.#host = host;
    this.#sources = sources;
    this.#question = new LatestQuestion(() => sources.text());
  }

  suggest(): void {
    const caret = this.#sources.caret();
    if (caret === null) {
      this.close();

      return;
    }

    this.#question.ask(
      (text) => this.#sources.assistant.completions(text, caret),
      (items, text) => this.#show(CompletionList.from(text, items))
    );
  }

  refresh(): void {
    if (this.#list !== null) {
      this.suggest();
    }
  }

  input(
    event: InputEvent
  ): void {
    const typed = event.inputType === "insertText" &&
      kTrigger.test(event.data ?? "");
    const erased = event.inputType.startsWith("delete") && this.#list !== null;
    if (typed || erased) {
      this.suggest();
    }
    else {
      this.close();
    }
  }

  key(
    event: KeyboardEvent
  ): boolean {
    if (event.isComposing || event.altKey) {
      return false;
    }
    if (event.ctrlKey || event.metaKey) {
      if (event.code !== "Space") {
        return false;
      }
      this.suggest();

      return true;
    }

    const list = this.#list;
    if (list === null) {
      return false;
    }
    switch (event.key) {
      case "ArrowDown":
        this.#show(list.move(1));
        break;
      case "ArrowUp":
        this.#show(list.move(-1));
        break;
      case "PageDown":
        this.#show(list.move(kVisibleCompletions));
        break;
      case "PageUp":
        this.#show(list.move(-kVisibleCompletions));
        break;
      case "Enter":
      case "Tab":
        this.#accept(list.selected);
        break;
      case "Escape":
        this.close();
        break;
      default:
        return false;
    }

    return true;
  }

  close(): void {
    this.#question.cancel();
    this.#show(null);
  }

  render(
    layout: CodeLayout
  ): TemplateResult | typeof nothing {
    const list = this.#list;
    if (list === null) {
      return nothing;
    }

    const position = layout.lines.position(list.chosen.start);
    const { first, items } = list.window(kVisibleCompletions);

    return html`
      <div
        class="completions"
        role="listbox"
        aria-label="Completions"
        style=${styleMap({
          top: layout.top(position.line + 1),
          left: `${layout.lines.visualColumn(position)}ch`
        })}
        @mousedown=${(event: MouseEvent) => event.preventDefault()}
      >
        ${items.map((item, index) => html`
          <div
            class="completion ${first + index === list.selected ? "selected" : ""}"
            role="option"
            aria-selected=${first + index === list.selected}
            @click=${() => this.#accept(first + index)}
          >
            <span>${item.name}</span>
            <span class="completion-kind">${item.kind}</span>
          </div>
        `)}
      </div>
    `;
  }

  #show(
    list: CompletionList | null
  ): void {
    if (list !== this.#list) {
      this.#list = list;
      this.#host.requestUpdate();
    }
  }

  #accept(
    index: number
  ): void {
    const list = this.#list;
    this.close();
    if (list !== null && list.text === this.#sources.text()) {
      this.#sources.accept(list.accept(index));
    }
  }
}
