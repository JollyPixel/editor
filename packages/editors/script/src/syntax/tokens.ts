// Import Third-party Dependencies
import {
  css,
  html,
  type TemplateResult
} from "lit";
import type { ParsedToken } from "sugar-high/core";

// CONSTANTS
const kPlainTokens = new Set<ParsedToken["type"]>([
  "identifier",
  "sign",
  "space",
  "break"
]);

export const CODE_TOKEN_COLORS = css`
  :host {
    --code-foreground: light-dark(#24292f, #d4d8de);
  }

  .token-keyword {
    color: light-dark(#cf222e, #f97583);
  }

  .token-string {
    color: light-dark(#0a3069, #9ecbff);
  }

  .token-comment {
    color: light-dark(#6e7781, #7d8590);
  }

  .token-class {
    color: light-dark(#0550ae, #79b8ff);
  }

  .token-property {
    color: light-dark(#953800, #ffab70);
  }

  .token-entity {
    color: light-dark(#8250df, #b392f0);
  }

  .token-jsxliterals {
    color: light-dark(#116329, #85e89d);
  }
`;

export function tokenSpan(
  token: ParsedToken
): TemplateResult | string {
  if (kPlainTokens.has(token.type)) {
    return token.value;
  }

  return html`<span class="token-${token.type}">${token.value}</span>`;
}
