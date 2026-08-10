// Import Third-party Dependencies
import { css } from "lit";

/**
 * Inherited density tokens with fixed 32px icon targets.
 */
export const densityTokens = css`
  :host {
    --jolly-row-height: 22px;
    --jolly-font-size: 12px;
    --jolly-control-height: 22px;
    --jolly-icon-button-size: 32px;
  }

  :host([density="compact"]) {
    --jolly-row-height: 18px;
    --jolly-font-size: 11px;
    --jolly-control-height: 18px;
  }

  :host([density="comfortable"]) {
    --jolly-row-height: 28px;
    --jolly-font-size: 13px;
    --jolly-control-height: 28px;
  }
`;
