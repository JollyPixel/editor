// Import Third-party Dependencies
import { css } from "lit";

/**
 * Axis-box styles shared by vectors and Quaternion's Euler inputs.
 */
export const vectorFieldStyles = css`
  .axes {
    display: flex;
    flex: 1 1 auto;
    gap: var(--jolly-space-1, 4px);
    min-width: 0;
  }

  .axis-box {
    position: relative;
    display: flex;
    flex: 1 1 0;
    align-items: center;
    min-width: 0;
  }

  .axis-box input {
    flex: 1 1 auto;
    min-width: 0;
    height: var(--jolly-control-height, 20px);
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg, transparent);
    color: inherit;
    font: inherit;
    font-variant-numeric: inherit;
    transition: background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  /* Match the shared input rule's specificity to preserve the scrub inset. */
  .value .axis-box input:not([type="color"]) {
    padding: 0 var(--jolly-space-1, 4px) 0 10px;
  }

  .axis-box input:hover:not(:disabled) {
    background: var(--jolly-control-bg-hover);
  }

  .axis-box input:focus {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  :host([invalid]) .axis-box input {
    background: var(--jolly-invalid-bg);
  }

  :host([readonly]) .axis-box input {
    background: var(--jolly-control-bg-muted);
  }

  /* Axis color is decorative; aria-label carries the accessible identity. */
  .axis-tag {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    width: 0;
    height: 0;
    overflow: hidden;
    border-width: 6px;
    border-style: solid;
    border-color:
      var(--jolly-axis-color, var(--jolly-border-strong))
      var(--jolly-axis-color, var(--jolly-border-strong))
      transparent
      transparent;
    color: transparent;
    font-size: 0;
    pointer-events: none;
  }

  .scrub-handle {
    position: absolute;
    inset-block: 1px;
    left: 1px;
    z-index: 1;
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
