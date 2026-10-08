// Import Third-party Dependencies
import { css } from "lit";

export const spinSliderStyles = css`
  .wrap {
    --jolly-slider-track-height: 2px;
    --jolly-slider-knob: 4px;
    --jolly-slider-groove: var(--jolly-groove);
    --jolly-slider-fill: var(--jolly-field-active-color);
    --jolly-slider-thumb-fill: var(--jolly-slider-fill);
    --jolly-slider-stop: calc(var(--jolly-slider-progress, 0) * 100%);

    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
  }

  .value .wrap input:not([type="color"]) {
    padding-bottom: var(--jolly-slider-track-height);
  }

  :host([scrubbable]) .wrap {
    touch-action: none;
  }

  :host([scrubbable]) .wrap input:not(:focus) {
    cursor: ew-resize;
  }

  .bar {
    position: absolute;
    bottom: 0;
    inset-inline: var(--jolly-space-1, 4px);
    height: 6px;
  }

  :host([scrubbable]) .bar {
    cursor: pointer;
  }

  .bar::before {
    content: "";
    position: absolute;
    bottom: 2px;
    inset-inline: 0;
    height: var(--jolly-slider-track-height);
    border-radius: 1px;
    background: linear-gradient(
      to right,
      var(--jolly-slider-fill) 0 var(--jolly-slider-stop),
      var(--jolly-slider-groove) var(--jolly-slider-stop) 100%
    );
    pointer-events: none;
  }

  .bar::after {
    content: "";
    position: absolute;
    bottom: 1px;
    left: calc(var(--jolly-slider-stop) - (var(--jolly-slider-knob) / 2));
    width: var(--jolly-slider-knob);
    height: var(--jolly-slider-knob);
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-slider-thumb-fill);
    opacity: 0;
    pointer-events: none;
    transition:
      opacity var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  :host([scrubbable]) .wrap:is(:hover, :focus-within) .bar::after {
    opacity: 1;
  }

  :host([scrubbable]) .bar:hover {
    --jolly-slider-thumb-fill: var(--jolly-field-active-color-hover);
  }

  :host([invalid]) .wrap {
    --jolly-slider-fill: var(--jolly-danger-border);
    --jolly-slider-groove: var(--jolly-invalid-bg-focus);
    --jolly-slider-thumb-fill: var(--jolly-danger-border);
  }

  :host([readonly]) .wrap {
    --jolly-slider-groove: var(--jolly-control-bg-muted);
  }

  :host([mixed]) .bar,
  :host([disabled]) .bar {
    opacity: 0.35;
  }
`;
