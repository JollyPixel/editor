// Import Third-party Dependencies
import {
  css,
  html,
  nothing,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { ScriptDiagnostic } from "@jolly-pixel/scripting";
import type { ScriptQuickInfo } from "@jolly-pixel/scripting/language";

// Import Internal Dependencies
import type { CodeDiagnostics } from "../../diagnostics/CodeDiagnostics.ts";
import type { CodeAssistant } from "../../language/CodeAssistant.ts";
import { LatestQuestion } from "../../language/LatestQuestion.ts";
import type { TextLines } from "../../text/TextLines.ts";
import type {
  CodeLayout,
  CodePoint
} from "./CodeViewport.ts";

export interface HoverHintSources {
  readonly assistant: CodeAssistant;
  readonly diagnostics: CodeDiagnostics;
  lines(): TextLines;
  pointAt(x: number, y: number): CodePoint | null;
}

interface CodeHover {
  readonly offset: number;
  readonly diagnostics: readonly ScriptDiagnostic[];
  readonly info: ScriptQuickInfo | null;
}

// CONSTANTS
const kHoverDelayMs = 400;

export const HOVER_STYLES = css`
  .hover {
    position: absolute;
    z-index: 3;
    display: grid;
    gap: 4px;
    max-width: min(72ch, 90%);
    padding: 6px 8px;
    border: 1px solid var(--jolly-border);
    border-radius: var(--jolly-radius-sm);
    color: var(--jolly-text);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-floating);
    font-family: var(--jolly-font-family);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    user-select: text;
  }

  .hover-message {
    padding-inline-start: 8px;
    border-inline-start: 2px solid var(--code-warning);
  }

  .hover-message.error {
    border-color: var(--code-error);
  }

  .hover-code,
  .hover-doc {
    color: var(--jolly-text-muted);
  }

  .hover-signature {
    font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  }
`;

export class HoverHint {
  #host: ReactiveControllerHost;
  #sources: HoverHintSources;
  #question: LatestQuestion;
  #hover: CodeHover | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    host: ReactiveControllerHost,
    sources: HoverHintSources
  ) {
    this.#host = host;
    this.#sources = sources;
    this.#question = new LatestQuestion(() => sources.lines().text);
  }

  track(
    event: PointerEvent,
    bounds: DOMRect
  ): void {
    const point = this.#sources.pointAt(event.clientX - bounds.left, event.clientY - bounds.top);
    const offset = point === null ?
      null :
      this.#sources.lines().offsetAt(point.line, point.visualColumn);
    clearTimeout(this.#timer);
    if (offset !== null && this.#hover !== null && covers(this.#hover, offset)) {
      return;
    }

    this.#timer = setTimeout(
      () => (offset === null ? this.hide() : this.#show(offset)),
      kHoverDelayMs
    );
  }

  hold(): void {
    clearTimeout(this.#timer);
  }

  leave(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.hide(), kHoverDelayMs);
  }

  hide(): void {
    clearTimeout(this.#timer);
    this.#question.cancel();
    if (this.#hover !== null) {
      this.#hover = null;
      this.#host.requestUpdate();
    }
  }

  render(
    layout: CodeLayout
  ): TemplateResult | typeof nothing {
    const hover = this.#hover;
    if (hover === null || (hover.diagnostics.length === 0 && hover.info === null)) {
      return nothing;
    }

    const position = layout.lines.position(hover.offset);
    const { info } = hover;

    return html`
      <div
        class="hover"
        role="tooltip"
        style=${styleMap({
          top: layout.top(position.line + 1),
          left: `${layout.lines.visualColumn(position)}ch`
        })}
        @pointerenter=${() => this.hold()}
        @pointerleave=${() => this.leave()}
      >
        ${hover.diagnostics.map((diagnostic) => html`
          <div class="hover-message ${diagnostic.severity}">${diagnostic.message}${
            diagnostic.code === null ?
              nothing :
              html` <span class="hover-code">${diagnostic.code}</span>`
          }</div>
        `)}
        ${info === null ? nothing : html`
          <code class="hover-signature">${info.signature}</code>
          ${info.documentation === "" ? nothing : html`<div class="hover-doc">${info.documentation}</div>`}
        `}
      </div>
    `;
  }

  #show(
    offset: number
  ): void {
    const hover: CodeHover = {
      offset,
      diagnostics: this.#sources.diagnostics.at(offset),
      info: null
    };
    this.#hover = hover;
    this.#host.requestUpdate();

    this.#question.ask(
      (text) => this.#sources.assistant.quickInfo(text, offset),
      (info) => {
        this.#hover = {
          ...hover,
          info
        };
        this.#host.requestUpdate();
      }
    );
  }
}

function covers(
  hover: CodeHover,
  offset: number
): boolean {
  const spans = [
    ...hover.diagnostics,
    ...(hover.info === null ? [] : [hover.info])
  ];

  return spans.some((span) => span.start <= offset && offset <= span.start + span.length);
}
