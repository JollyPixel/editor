// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { scrubHandleStyles } from "../interaction/scrub/scrubHandle.styles.ts";
import { fillTransition } from "../theme/styles/mixins.ts";

export const vectorFieldStyles = css`
  :host {
    --jolly-axis-letter-width: var(--jolly-control-height, 20px);
  }

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
    box-sizing: border-box;
    flex: 1 1 auto;
    width: calc(20ch + 20px);
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

  :host([axis-style="chip"]) .value .axis-box input:not([type="color"]),
  :host([axis-style="letter"]) .value .axis-box input:not([type="color"]) {
    padding-left: calc(
      var(--jolly-axis-letter-width) + var(--jolly-space-1, 4px)
    );
  }

  :host([axis-style="chip"]) .scrub-handle,
  :host([axis-style="letter"]) .scrub-handle {
    display: grid;
    place-items: center;
    width: var(--jolly-axis-letter-width);
    font-size: calc(var(--jolly-font-size, 12px) - 1px);
    font-weight: 600;
    line-height: 1;
    user-select: none;

    ${fillTransition}
  }

  :host([axis-style="chip"]) .scrub-handle::before,
  :host([axis-style="letter"]) .scrub-handle::before {
    content: none;
  }

  :host([axis-style="chip"]) .scrub-handle {
    inset-block: 0;
    left: 0;
    background: var(--jolly-axis-color, var(--jolly-border-strong));
    color: var(--jolly-text-on-fill);
  }

  :host([axis-style="chip"][scrubbable]) .scrub-handle:hover {
    background: oklch(
      from var(--jolly-axis-color, var(--jolly-border-strong))
      calc(l + 0.08) c h
    );
  }

  :host([axis-style="letter"]) .scrub-handle {
    color: var(--jolly-axis-text-color, var(--jolly-text-muted));
  }

  :host([axis-style="letter"][scrubbable]) .scrub-handle:hover {
    background: var(--jolly-control-bg-hover);
  }
`;
