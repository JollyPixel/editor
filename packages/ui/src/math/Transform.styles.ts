// Import Third-party Dependencies
import { css } from "lit";

export const transformStyles = css`
  :host {
    /*
     * Position, rotation and scale lock independently, so any one of them can
     * grow its gutter for a lock glyph. Reserving it for all three up front is
     * what keeps their labels aligned regardless of which is locked.
     */
    --jolly-gutter-width: 14px;

    display: flex;
    flex-direction: column;
    gap: var(--jolly-row-gap, 0px);
  }

  :host([label-position="top"]) {
    gap: var(--jolly-space-2, 8px);
  }
`;
