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

// Import Internal Dependencies
import type {
  CommandConsole,
  ScriptResult
} from "../CommandConsole.ts";
import { highlightLine } from "../script/highlightLine.ts";
import type {
  ScriptDiagnostic,
  ScriptDraft
} from "../script/ScriptDraft.ts";
import type { VariableScript } from "../script/VariableScript.ts";
import { consoleScriptStyles } from "./ConsoleScript.styles.ts";

interface ScriptStatus {
  text: string;
  invalid: boolean;
}

@customElement("jolly-console-script")
export class ConsoleScriptElement extends LitElement {
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true
  };

  static override styles = consoleScriptStyles;

  @property({ attribute: false })
  declare console: CommandConsole | null;

  @property({ attribute: false })
  declare script: VariableScript | null;

  @state()
  declare _text: string;

  @state()
  declare _error: string | null;

  @state()
  declare _saving: boolean;

  @query("textarea")
  declare _textarea: HTMLTextAreaElement | null;

  #draft: ScriptDraft | null = null;

  constructor() {
    super();

    this.console = null;
    this.script = null;
    this._text = "";
    this._error = null;
    this._saving = false;
  }

  async save(): Promise<boolean> {
    const commands = this.console;
    const draft = this.#draft;
    if (commands === null || draft === null || this._saving) {
      return false;
    }
    if (!draft.ok) {
      this.#reveal(draft.diagnostics[0]);

      return false;
    }

    this._saving = true;
    let result: ScriptResult;
    try {
      result = await commands.applyScript(draft);
    }
    finally {
      this._saving = false;
    }
    if (!result.ok) {
      this._error = result.error;

      return false;
    }
    this.#close();

    return true;
  }

  cancel(): void {
    if (!this._saving) {
      this.#close();
    }
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("script")) {
      this._text = this.script?.text ?? "";
      this._error = null;
    }
    if (changed.has("script") || changed.has("_text")) {
      this.#draft = this.script?.parse(this._text) ?? null;
    }
  }

  override render(): TemplateResult {
    const draft = this.#draft;
    const invalidLines = new Set(
      draft?.diagnostics.map((diagnostic) => diagnostic.line)
    );
    const lineCount = draft?.lines.length ?? 1;
    const status = this.#status();

    return html`
      <div class="scroller">
        <div class="gutter" aria-hidden="true">${Array.from(
          { length: lineCount },
          (_, index) => html`<div class=${invalidLines.has(index + 1) ? "invalid" : ""}>${index + 1}</div>`
        )}</div>
        <div class="code">
          <pre aria-hidden="true">${this.#highlight()}</pre>
          <textarea
            aria-label="Variables script"
            aria-describedby="status"
            aria-invalid=${draft?.ok === false ? "true" : nothing}
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            wrap="off"
            rows="1"
            ?readonly=${this._saving}
            .value=${live(this._text)}
            @input=${this.#onInput}
            @keydown=${this.#onKeyDown}
          ></textarea>
        </div>
      </div>
      <div
        id="status"
        class=${status.invalid ? "status invalid" : "status"}
        role="status"
      >${status.text}</div>
    `;
  }

  #highlight(): Array<TemplateResult | string> {
    const draft = this.#draft;
    if (draft === null) {
      return [];
    }

    const output: Array<TemplateResult | string> = [];
    draft.lines.forEach((line, index) => {
      const number = index + 1;
      const errors = draft.diagnostics
        .filter((diagnostic) => diagnostic.line === number);
      if (index > 0) {
        output.push("\n");
      }
      for (const piece of highlightLine(line, draft.valueType(number), errors)) {
        const classes = [piece.kind, piece.error ? "error" : null]
          .filter((name) => name !== null)
          .join(" ");
        output.push(
          classes === "" ? piece.text : html`<span class=${classes}>${piece.text}</span>`
        );
      }
    });
    output.push(" ");

    return output;
  }

  #status(): ScriptStatus {
    if (this._saving) {
      return {
        text: "Saving…",
        invalid: false
      };
    }
    if (this._error !== null) {
      return {
        text: this._error,
        invalid: true
      };
    }

    const draft = this.#draft;
    if (draft === null) {
      return {
        text: "",
        invalid: false
      };
    }

    const [first, ...others] = draft.diagnostics;
    if (first !== undefined) {
      const more = others.length === 0 ? "" : ` (+${others.length} more)`;

      return {
        text: `Line ${first.line}: ${first.message}${more}`,
        invalid: true
      };
    }

    const count = draft.changes.length;

    return {
      text: count === 0 ? "No changes" : `${count} ${count === 1 ? "change" : "changes"}`,
      invalid: false
    };
  }

  #reveal(
    diagnostic: ScriptDiagnostic | undefined
  ): void {
    const textarea = this._textarea;
    const draft = this.#draft;
    if (textarea === null || draft === null || diagnostic === undefined) {
      return;
    }

    let offset = 0;
    for (const line of draft.lines.slice(0, diagnostic.line - 1)) {
      offset += line.text.length + 1;
    }
    textarea.focus();
    textarea.setSelectionRange(
      offset + diagnostic.start,
      offset + diagnostic.end
    );
  }

  #close(): void {
    this.dispatchEvent(new Event("script-close"));
  }

  readonly #onInput = (
    event: Event
  ): void => {
    if (event.target instanceof HTMLTextAreaElement) {
      this._text = event.target.value;
      this._error = null;
    }
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.isComposing) {
      return;
    }

    const modifier = event.ctrlKey || event.metaKey;
    if (event.key === "Escape" && !modifier) {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
    }
    else if (
      modifier &&
      !event.altKey &&
      (event.key.toLowerCase() === "s" || event.key === "Enter")
    ) {
      event.preventDefault();
      void this.save();
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-console-script": ConsoleScriptElement;
  }
}
