// Import Third-party Dependencies
import { css } from "lit";

/**
 * Inherited density tokens with fixed 32px icon targets.
 *
 * Row heights lost the 1px control border they used to include, so each preset
 * is 2px shorter than it was. With the container gap the default pitch is 24px.
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
