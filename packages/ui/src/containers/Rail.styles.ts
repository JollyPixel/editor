// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/fallbacks.ts";

/*
 * A rail is a plane, and a recessed one. It reads against the dock beside it
 * through that step alone, which replaces both the divider rule and the inset
 * highlight that used to fake an edge.
 */
export const railStyles = css`
  :host {
    display: flex;
    box-sizing: border-box;
    align-items: center;
    flex-direction: column;
    gap: var(--jolly-space-1, 4px);
    width: calc(var(--jolly-icon-button-size, 32px) + (var(--jolly-space-1, 4px) * 2));
    padding: var(--jolly-space-1, 4px);
    border: 0;
    background: var(--jolly-surface-sunken, ${kFallback.controlBg});
  }

  :host([orientation="horizontal"]) {
    flex-direction: row;
    width: auto;
    height: calc(var(--jolly-icon-button-size, 32px) + (var(--jolly-space-1, 4px) * 2));
  }
`;
