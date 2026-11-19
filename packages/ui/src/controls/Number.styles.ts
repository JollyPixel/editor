// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { scrubHandleStyles } from "../interaction/scrub/scrubHandle.styles.ts";
import { fillTransition } from "../theme/styles/mixins.ts";

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

  .value .wrap:has(.steppers) input {
    padding-right: 14px;
  }

  .steppers {
    position: absolute;
    z-index: 1;
    inset-block: 1px;
    right: 1px;
    display: flex;
    flex-direction: column;
    width: 12px;
  }

  .stepper {
    position: relative;
    flex: 1 1 0;
    border-radius: var(--jolly-radius-sm, 2px);
    color: var(--jolly-text-muted);
    cursor: pointer;
    touch-action: none;

    ${fillTransition}
  }

  .stepper::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6px;
    height: 4px;
    background: currentcolor;
    transform: translate(-50%, -50%);
  }

  .stepper[data-direction="up"]::before {
    clip-path: polygon(50% 0, 100% 100%, 0 100%);
  }

  .stepper[data-direction="down"]::before {
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }

  .stepper:hover {
    background: var(--jolly-control-bg-hover);
    color: var(--jolly-text);
  }

  .stepper:active {
    background: var(--jolly-control-bg-focus);
  }

  .stepper[data-at-bound] {
    opacity: 0.35;
    cursor: default;
  }

  ${scrubHandleStyles}
`;
