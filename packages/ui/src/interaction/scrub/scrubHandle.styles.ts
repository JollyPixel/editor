// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { fillTransition } from "../../theme/styles/mixins.ts";

export const scrubHandleStyles = css`
  .scrub-handle {
    position: absolute;
    inset-block: 1px;
    left: 1px;
    width: 8px;
    border-radius: var(--jolly-radius-sm, 2px) 0 0 var(--jolly-radius-sm, 2px);
  }

  :host([scrubbable]) .scrub-handle {
    cursor: ew-resize;
    touch-action: none;
  }

  .scrub-handle::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 2px;
    height: 55%;
    border-radius: 1px;
    background: var(--jolly-groove);
    transform: translate(-50%, -50%);

    ${fillTransition}
    transition-property: background-color, width, height, border-radius;
  }

  :host([scrubbable]) .scrub-handle:hover::before,
  .scrub-handle[data-scrubbing]::before {
    background: var(--jolly-text);
  }

  .scrub-handle[data-scrubbing]::before {
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }
`;
