// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import { styleMap } from "lit/directives/style-map.js";
import {
  TextEdit,
  type ScriptChange,
  type ScriptDocument
} from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import type {
  PeerCaret,
  ScriptCollaboration
} from "../../collaboration/ScriptCollaboration.ts";
import {
  insertIndent,
  insertNewline,
  removeIndent,
  type KeyEdit
} from "../../text/EditingKeys.ts";
import { LineRange } from "../../text/LineRange.ts";
import { changedSpan } from "../../text/changedSpan.ts";
import { ScriptCaret } from "../../text/ScriptCaret.ts";
import { TextLines } from "../../text/TextLines.ts";
import {
  CODE_TOKEN_COLORS,
  tokenSpan
} from "../../syntax/tokens.ts";
import { CodeViewport } from "./CodeViewport.ts";
import { CodeTokens } from "../../syntax/CodeTokens.ts";
import type { ScriptLanguage } from "../../syntax/highlight.ts";

export interface ScriptCodeOptions {
  document: ScriptDocument;
  collaboration: ScriptCollaboration;
  language: ScriptLanguage;
  readOnly: boolean;
}

export class ScriptCode extends LitElement {
  static override styles = [CODE_TOKEN_COLORS, css`
    :host {
      display: block;
      position: relative;
      min-height: 0;
      color: var(--code-foreground);
      background: var(--jolly-surface-sunken);
      font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
      font-size: 13px;
      line-height: var(--script-line-height);
      tab-size: 2;
    }

    .scroller {
      position: absolute;
      inset: 0;
      overflow: auto;
      padding-block-start: var(--script-padding-top);
    }

    .sizer {
      display: flex;
      min-width: 100%;
    }

    .gutter {
      position: sticky;
      left: 0;
      z-index: 2;
      flex: none;
      width: 6ch;
      color: var(--jolly-text-muted);
      background: var(--jolly-surface-sunken);
      text-align: end;
      user-select: none;
    }

    .content {
      position: relative;
      flex: 1;
      margin-inline-start: 1.5ch;
    }

    .number,
    .line,
    .selection,
    .caret {
      position: absolute;
      height: var(--script-line-height);
    }

    .number {
      right: 1ch;
    }

    .number.current {
      color: var(--jolly-text);
    }

    .line {
      left: 0;
      white-space: pre;
    }

    .selection {
      opacity: 0.25;
    }

    .caret {
      width: 0;
      border-inline-start: 2px solid;
    }

    .caret span {
      position: absolute;
      bottom: 100%;
      left: -2px;
      padding: 0 4px;
      border-radius: 3px 3px 3px 0;
      color: #fff;
      font-family: var(--jolly-font-family);
      font-size: 10px;
      line-height: 14px;
      white-space: nowrap;
    }

    textarea {
      position: absolute;
      inset: 0;
      z-index: 1;
      width: 100%;
      height: 100%;
      padding: 0;
      border: none;
      outline: none;
      overflow: hidden;
      resize: none;
      color: transparent;
      background: transparent;
      caret-color: var(--jolly-text);
      font: inherit;
      line-height: inherit;
      white-space: pre;
      tab-size: inherit;
    }

    textarea::selection {
      background: color-mix(in srgb, var(--jolly-accent-500) 35%, transparent);
    }

    .probe {
      position: absolute;
      visibility: hidden;
      white-space: pre;
    }
  `];

  #document: ScriptDocument | null = null;
  #collaboration: ScriptCollaboration | null = null;
  #readOnly = true;
  #lines = new TextLines("");
  #tokens = new CodeTokens(() => this.requestUpdate());
  #carets: readonly PeerCaret[] = [];
  #release: Array<() => void> = [];
  #viewport = new CodeViewport(this, {
    scroller: () => this.renderRoot.querySelector(".scroller"),
    gutter: () => this.renderRoot.querySelector(".gutter"),
    probe: () => this.renderRoot.querySelector(".probe")
  });

  #onSelectionChange = (): void => {
    const textarea = this.#textarea;
    if (textarea === null || this.shadowRoot?.activeElement !== textarea) {
      return;
    }

    this.#collaboration?.publish(ScriptCaret.from(textarea));
    this.requestUpdate();
  };

  attach(
    options: ScriptCodeOptions
  ): () => void {
    this.#detach();
    const { document, collaboration, language, readOnly } = options;
    this.#document = document;
    this.#collaboration = collaboration;
    this.#readOnly = readOnly;
    this.#lines = new TextLines(document.text);
    this.#tokens.reset(this.#lines, language);
    this.#carets = collaboration.carets;
    const page = this.ownerDocument;
    page.addEventListener("selectionchange", this.#onSelectionChange);
    this.#release = [
      document.subscribe("change", (change) => this.#follow(change)),
      collaboration.subscribe("caretsChange", (carets) => {
        this.#carets = carets;
        this.requestUpdate();
      }),
      () => page.removeEventListener("selectionchange", this.#onSelectionChange)
    ];
    this.#syncTextarea(ScriptCaret.collapsed(0));
    this.requestUpdate();

    return () => this.#detach();
  }

  focusEditor(): void {
    this.#textarea?.focus();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#detach();
  }

  protected override firstUpdated(
    _changed: PropertyValues
  ): void {
    this.#syncTextarea(ScriptCaret.collapsed(0));
  }

  override render(): TemplateResult {
    const height = this.#viewport.height(this.#lines);
    const width = this.#viewport.width(this.#lines);
    const visible = this.#viewport.visible(this.#lines.range);
    const current = this.#textarea === null ?
      -1 :
      this.#lines.position(this.#textarea.selectionStart).line;

    return html`
      <div class="scroller" @scroll=${() => this.#viewport.schedule()}>
        <div class="sizer" style=${styleMap({ height })}>
          <div class="gutter" aria-hidden="true">
            ${visible.map((line) => html`
              <div
                class="number ${line === current ? "current" : ""}"
                style=${styleMap({ top: this.#viewport.top(line) })}
              >${line + 1}</div>
            `)}
          </div>
          <div class="content" style=${styleMap({ minWidth: width })}>
            <div aria-hidden="true">
              ${this.#carets.map((caret) => this.#renderSelection(caret))}
              ${visible.map((line) => html`
                <div class="line" style=${styleMap({ top: this.#viewport.top(line) })}>${
                  this.#renderTokens(line)
                }</div>
              `)}
              ${this.#carets.map((caret) => this.#renderCaret(caret))}
            </div>
            <textarea
              aria-label="Script source"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
              wrap="off"
              ?readonly=${this.#readOnly}
              @input=${() => this.#onInput()}
              @keydown=${(event: KeyboardEvent) => this.#onKeyDown(event)}
              @beforeinput=${(event: InputEvent) => this.#onBeforeInput(event)}
              @focus=${() => this.#revealCaret()}
            ></textarea>
            <span class="probe">0000000000</span>
          </div>
        </div>
      </div>
    `;
  }

  get #textarea(): HTMLTextAreaElement | null {
    return this.renderRoot.querySelector("textarea");
  }

  #renderTokens(
    line: number
  ): TemplateResult {
    return html`${(this.#tokens.line(line)?.tokens ?? []).map(tokenSpan)}`;
  }

  #renderCaret(
    { peer, caret }: PeerCaret
  ): TemplateResult {
    const head = this.#lines.position(caret.head);

    return html`
      <div
        class="caret"
        style=${styleMap({
          top: this.#viewport.top(head.line),
          left: `${this.#lines.visualColumn(head)}ch`,
          borderColor: peer.color
        })}
      ><span style=${styleMap({ background: peer.color })}>${peer.displayName}</span></div>
    `;
  }

  #renderSelection(
    { peer, caret }: PeerCaret
  ): TemplateResult | typeof nothing {
    if (caret.collapsed) {
      return nothing;
    }

    const start = this.#lines.position(caret.start);
    const end = this.#lines.position(caret.end);
    const rows = this.#viewport.visible(new LineRange(start.line, end.line)).map((line) => {
      const from = line === start.line ? this.#lines.visualColumn(start) : 0;
      const to = line === end.line ?
        this.#lines.visualColumn(end) :
        this.#lines.visualWidth(line) + 1;

      return html`
        <div
          class="selection"
          style=${styleMap({
            top: this.#viewport.top(line),
            left: `${from}ch`,
            width: `${Math.max(to - from, 0)}ch`,
            background: peer.color
          })}
        ></div>
      `;
    });

    return html`${rows}`;
  }

  #follow(
    { edit, origin }: ScriptChange
  ): void {
    const document = this.#document;
    if (document === null) {
      return;
    }

    this.#lines = new TextLines(document.text);
    this.#tokens.read(this.#lines);
    const textarea = this.#textarea;
    if (origin !== "input" && textarea !== null) {
      this.#syncTextarea(
        caretAfter(edit, origin, ScriptCaret.from(textarea), document.text.length)
      );
    }
    this.requestUpdate();
  }

  #syncTextarea(
    caret: ScriptCaret
  ): void {
    const textarea = this.#textarea;
    const text = this.#document?.text ?? "";
    if (textarea === null) {
      return;
    }
    if (textarea.value !== text) {
      this.#replaceText(textarea, text);
    }
    caret.selectIn(textarea);
  }

  #replaceText(
    textarea: HTMLTextAreaElement,
    text: string
  ): void {
    const scroller = this.renderRoot.querySelector(".scroller");
    const top = scroller?.scrollTop ?? 0;
    const left = scroller?.scrollLeft ?? 0;
    replaceText(textarea, text);
    scroller?.scrollTo(left, top);
  }

  #onInput(): void {
    const textarea = this.#textarea;
    const document = this.#document;
    if (textarea === null || document === null) {
      return;
    }

    const edit = TextEdit.between(document.text, textarea.value, textarea.selectionEnd);
    if (edit.empty) {
      return;
    }
    document.edit(edit);
    this.#revealCaret();
  }

  #onBeforeInput(
    event: InputEvent
  ): void {
    if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
      event.preventDefault();
      this.#travel(event.inputType === "historyRedo");
    }
  }

  #onKeyDown(
    event: KeyboardEvent
  ): void {
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && !event.altKey && (key === "z" || key === "y")) {
      event.preventDefault();
      this.#travel(key === "y" || event.shiftKey);
    }
    else if (event.key === "Tab" && !modifier && !event.altKey) {
      event.preventDefault();
      this.#applyKey(event.shiftKey ? removeIndent : insertIndent);
    }
    else if (event.key === "Enter" && !modifier && !event.altKey && !event.isComposing) {
      event.preventDefault();
      this.#applyKey(insertNewline);
    }
  }

  #travel(
    forward: boolean
  ): void {
    if (this.#readOnly || this.#document === null) {
      return;
    }

    if (forward) {
      this.#document.redo();
    }
    else {
      this.#document.undo();
    }
    this.#revealCaret();
  }

  #applyKey(
    command: (lines: TextLines, caret: ScriptCaret) => KeyEdit
  ): void {
    const textarea = this.#textarea;
    const document = this.#document;
    if (textarea === null || document === null || this.#readOnly) {
      return;
    }

    const { edit, caret } = command(this.#lines, ScriptCaret.from(textarea));
    document.edit(edit);
    this.#syncTextarea(caret);
    this.#revealCaret();
  }

  #revealCaret(): void {
    void this.updateComplete.then(() => {
      const textarea = this.#textarea;
      if (textarea === null) {
        return;
      }

      const { head } = ScriptCaret.from(textarea);
      this.#viewport.reveal(this.#lines.position(head), this.#lines);
    });
  }

  #detach(): void {
    this.#tokens.dispose();
    for (const release of this.#release.splice(0)) {
      release();
    }
    this.#document = null;
    this.#collaboration = null;
  }
}

function replaceText(
  textarea: HTMLTextAreaElement,
  text: string
): void {
  const root = textarea.getRootNode();
  if (root instanceof ShadowRoot && root.activeElement === textarea) {
    const { start, beforeEnd, afterEnd } = changedSpan(textarea.value, text);
    textarea.setSelectionRange(start, beforeEnd);
    textarea.ownerDocument.execCommand("insertText", false, text.slice(start, afterEnd));
    if (textarea.value === text) {
      return;
    }
  }

  textarea.value = text;
}

function caretAfter(
  edit: TextEdit,
  origin: ScriptChange["origin"],
  caret: ScriptCaret,
  length: number
): ScriptCaret {
  if (origin === "history") {
    const last = edit.changes.at(-1);

    return ScriptCaret.collapsed(last === undefined ?
      caret.end :
      last.at + ("insert" in last ? last.insert.length : 0));
  }
  if (origin === "load") {
    return caret.clamp(length);
  }

  return caret.follow(edit);
}

customElements.define("jolly-script-code", ScriptCode);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-script-code": ScriptCode;
  }
}
