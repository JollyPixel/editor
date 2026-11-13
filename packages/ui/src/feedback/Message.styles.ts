// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";

export const messageStyles = css`
  :host {
    display: block;
    margin: 0;
    padding: var(--jolly-space-1, 4px) var(--jolly-space-2, 8px);
    color: var(--jolly-text-muted, ${kFallback.text});
    overflow-wrap: anywhere;
  }

  :host([flush]) {
    padding: 0;
  }

  :host([tone="danger"]) {
    color: var(--jolly-danger, ${kFallback.inkDanger});
  }

  :host([tone="warning"]) {
    color: var(--jolly-warning, #fb3);
  }
`;
