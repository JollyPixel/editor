// Import Third-party Dependencies
import { css } from "lit";

export const previewWellStyles = css`
  .well {
    position: relative;
    overflow: hidden;
    background: light-dark(
      var(--jolly-neutral-200),
      color-mix(in oklab, var(--jolly-neutral-900), var(--jolly-neutral-800))
    );
    border-radius: var(--jolly-radius-sm, 3px);
  }

  .well canvas:focus-visible {
    outline: 1px solid var(--jolly-focus-ring, currentcolor);
    outline-offset: -1px;
  }

  .toggle {
    position: absolute;
    top: var(--jolly-space-1, 4px);
    left: var(--jolly-space-1, 4px);
    z-index: 1;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--jolly-radius-sm, 3px);
    background: transparent;
    color: var(--jolly-text-muted);
    cursor: pointer;
  }

  .toggle.trailing {
    right: var(--jolly-space-1, 4px);
    left: auto;
  }

  .toggle:hover,
  .toggle:focus-visible {
    background: var(--jolly-control-bg-hover);
    color: var(--jolly-text);
  }

  .toggle jolly-icon {
    width: 14px;
    height: 14px;
  }
`;
