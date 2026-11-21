// Import Third-party Dependencies
import {
  css,
  html,
  type TemplateResult
} from "lit";
import { styleMap } from "lit/directives/style-map.js";

// Import Internal Dependencies
import type { CodeDiagnostics } from "../../language/CodeDiagnostics.ts";
import type { CodeLayout } from "./CodeViewport.ts";

// CONSTANTS
const kEmptySpan = " ";

export const DIAGNOSTIC_STYLES = css`
  :host {
    --code-error: var(--jolly-danger, #f85149);
    --code-warning: var(--jolly-warning, #d29922);
  }

  .number.error {
    color: var(--code-error);
  }

  .number.warning {
    color: var(--code-warning);
  }

  .squiggle {
    position: absolute;
    height: var(--script-line-height);
    color: transparent;
    white-space: pre;
    text-decoration-line: underline;
    text-decoration-style: wavy;
    text-decoration-skip-ink: none;
    text-underline-offset: 3px;
  }

  .squiggle.error {
    text-decoration-color: var(--code-error);
  }

  .squiggle.warning {
    text-decoration-color: var(--code-warning);
  }
`;

export function renderSquiggles(
  layout: CodeLayout,
  line: number,
  diagnostics: CodeDiagnostics
): TemplateResult[] {
  const { lines } = layout;
  const text = lines.line(line);
  const from = lines.lineStart(line);
  const to = from + text.length;
  const squiggles: TemplateResult[] = [];
  for (const diagnostic of diagnostics.within(from, to)) {
    const start = Math.max(diagnostic.start, from) - from;
    const end = Math.min(diagnostic.start + diagnostic.length, to) - from;
    if (diagnostic.start < from && end <= start) {
      continue;
    }

    squiggles.push(html`
      <div
        class="squiggle ${diagnostic.severity}"
        style=${styleMap({
          top: layout.top(line),
          left: `${lines.visualColumn({ line, column: start })}ch`
        })}
      >${end > start ? text.slice(start, end) : kEmptySpan}</div>
    `);
  }

  return squiggles;
}
