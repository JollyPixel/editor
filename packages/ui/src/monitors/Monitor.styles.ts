// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";
import { truncate } from "../theme/styles/mixins.ts";

export const monitorStyles = css`
  :host {
    display: block;
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
    color: var(--jolly-text, ${kFallback.text});
  }

  :host([disabled]) {
    opacity: 0.5;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    min-height: var(--jolly-row-height, 20px);
    padding-inline: var(--jolly-space-1, 4px);
  }

  .label {
    flex: 1 1 auto;
    min-width: 0;
    color: var(--jolly-text-muted);
    ${truncate}
  }

  .value {
    flex: 0 0 auto;
    font-variant-numeric: var(--jolly-font-numeric, tabular-nums);
  }
`;
