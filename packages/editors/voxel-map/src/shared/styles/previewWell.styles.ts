// Import Third-party Dependencies
import { css } from "lit";

export const previewWellStyles = css`
  .well {
    overflow: hidden;
    background: light-dark(
      var(--jolly-neutral-200),
      color-mix(in oklab, var(--jolly-neutral-900), var(--jolly-neutral-800))
    );
    border-radius: var(--jolly-radius-sm, 3px);
  }
`;
