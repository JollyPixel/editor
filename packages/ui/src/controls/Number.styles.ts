// Import Third-party Dependencies
import { css } from "lit";

/**
 * The wrapper hosts the scrub handle over the native input.
 */
export const numberStyles = css`
  .wrap {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
  }

  /*
   * Match the base selector specificity for the padding override.
   */
  .value .wrap input:not([type="color"]) {
    padding-left: 10px;
  }

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
    left: 3px;
    width: 2px;
    height: 55%;
    border-radius: 1px;
    background: var(--jolly-groove);
    transform: translateY(-50%);
    transition: background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  :host([scrubbable]) .scrub-handle:hover::before {
    background: var(--jolly-accent-fill);
  }
`;
