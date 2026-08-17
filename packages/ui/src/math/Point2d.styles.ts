// Import Third-party Dependencies
import { css } from "lit";

export const point2dStyles = css`
  .pad {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg, transparent);
    cursor: crosshair;
    touch-action: none;
    transition: background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .pad:hover {
    background: var(--jolly-control-bg-hover);
  }

  .pad:focus-visible {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  :host([invalid]) .pad {
    background: var(--jolly-invalid-bg);
  }

  :host([readonly]) .pad {
    background: var(--jolly-control-bg-muted);
  }

  .pad[data-mixed] {
    opacity: 0.35;
  }

  .handle {
    position: absolute;
    top: calc(var(--jolly-pad-y, 0.5) * 100%);
    left: calc(var(--jolly-pad-x, 0.5) * 100%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--jolly-field-active-color);
    box-shadow: 0 0 0 1px var(--jolly-surface);
    pointer-events: none;
    transform: translate(-50%, -50%);
  }

  .handle[hidden] {
    display: none;
  }
`;
