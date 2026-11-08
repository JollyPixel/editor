// Import Third-party Dependencies
import {
  css,
  html,
  type TemplateResult
} from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { ThemedToken } from "@shikijs/core";

// CONSTANTS
const kItalic = 1;
const kBold = 2;
const kUnderline = 4;

export const CODE_TOKEN_COLORS = css`
  :host {
    --shiki-foreground: light-dark(#24292f, #d4d8de);
    --shiki-background: transparent;
    --shiki-token-constant: light-dark(#0550ae, #79b8ff);
    --shiki-token-string: light-dark(#0a3069, #9ecbff);
    --shiki-token-comment: light-dark(#6e7781, #7d8590);
    --shiki-token-keyword: light-dark(#cf222e, #f97583);
    --shiki-token-parameter: light-dark(#953800, #ffab70);
    --shiki-token-function: light-dark(#8250df, #b392f0);
    --shiki-token-string-expression: light-dark(#116329, #85e89d);
    --shiki-token-punctuation: light-dark(#24292f, #d4d8de);
    --shiki-token-link: light-dark(#0550ae, #79b8ff);
  }
`;

export function tokenSpan(
  token: ThemedToken
): TemplateResult {
  return html`<span style=${styleMap(tokenStyle(token))}>${token.content}</span>`;
}

function tokenStyle(
  token: ThemedToken
): Record<string, string> {
  const style: Record<string, string> = {};
  if (token.color !== undefined) {
    style.color = token.color;
  }
  const fontStyle = token.fontStyle ?? 0;
  if (fontStyle > 0) {
    if ((fontStyle & kItalic) !== 0) {
      style.fontStyle = "italic";
    }
    if ((fontStyle & kBold) !== 0) {
      style.fontWeight = "bold";
    }
    if ((fontStyle & kUnderline) !== 0) {
      style.textDecoration = "underline";
    }
  }

  return style;
}
