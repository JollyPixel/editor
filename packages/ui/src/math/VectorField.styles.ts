// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { scrubHandleStyles } from "../interaction/scrub/scrubHandle.styles.ts";
import { fillTransition } from "../theme/styles/mixins.ts";

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
    ${fillTransition}
  }

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

  ${scrubHandleStyles}

  .scrub-handle {
    z-index: 1;
  }
`;
