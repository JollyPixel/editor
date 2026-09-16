// Import Third-party Dependencies
import { css } from "lit";

/**
 * Icon targets stay 32px; the default row pitch is 24px with the container gap.
 */
export const densityTokens = css`
  :host {
    --jolly-row-height: 20px;
    --jolly-font-size: 11px;
    --jolly-control-height: 20px;
    --jolly-icon-button-size: 32px;
  }

  :host([density="compact"]) {
    --jolly-row-height: 16px;
    --jolly-font-size: 10px;
    --jolly-control-height: 16px;
  }

  :host([density="comfortable"]) {
    --jolly-row-height: 26px;
    --jolly-font-size: 12px;
    --jolly-control-height: 26px;
  }
`;
