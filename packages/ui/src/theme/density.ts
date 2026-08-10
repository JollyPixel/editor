// Import Third-party Dependencies
import { css } from "lit";

/**
 * Inherited, so a nested pane can override its parent. Icon buttons stay 32px at every density:
 * an 18px pointer target is not usable.
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
