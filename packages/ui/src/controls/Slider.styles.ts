// Import Third-party Dependencies
import { css } from "lit";

export const sliderStyles = css`
  /*
   * The lane paints nothing. It is only the positioning context and the hit
   * area, so the slider reads as a measurement on the surface rather than as a
   * filled control.
   *
   * The track, the range input and the stop calculation all share the same
   * horizontal inset, so the fill edge lands under the knob centre.
   */
  .lane {
    --jolly-slider-knob: 10px;
    --jolly-slider-track-height: 2px;
    --jolly-slider-inset: var(--jolly-space-1, 4px);
    --jolly-slider-groove: var(--jolly-groove);
    --jolly-slider-fill: var(--jolly-accent-fill);
    --jolly-slider-thumb-fill: var(--jolly-slider-fill);
    --jolly-slider-stop: calc(
      var(--jolly-slider-progress, 0) * (100% - var(--jolly-slider-knob)) +
        (var(--jolly-slider-knob) / 2)
    );

    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    height: var(--jolly-control-height, 20px);
    background: none;
  }

  /*
   * The track. A 2px groove with the filled portion in the accent, which reads
   * as a measurement rather than as a second filled control.
   */
  .lane::before {
    content: "";
    position: absolute;
    top: 50%;
    inset-inline: var(--jolly-slider-inset);
    height: var(--jolly-slider-track-height);
    border-radius: 1px;
    background: linear-gradient(
      to right,
      var(--jolly-slider-fill) 0 var(--jolly-slider-stop),
      var(--jolly-slider-groove) var(--jolly-slider-stop) 100%
    );
    transform: translateY(-50%);
    pointer-events: none;
    transition: height var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  /* Hover changes only the handle color, so the track geometry stays still. */
  .lane:hover {
    --jolly-slider-thumb-fill: var(--jolly-accent-fill-hover);
  }

  /* Focus geometry locates the active slider in a long pane. */
  .lane:has(input:focus-visible) {
    --jolly-slider-track-height: 4px;
    --jolly-slider-knob: 14px;
  }

  /* An invalid slider recolours the value itself, not just the groove behind it. */
  :host([invalid]) .lane {
    --jolly-slider-fill: var(--jolly-danger-border);
    --jolly-slider-groove: var(--jolly-invalid-bg-focus);
    --jolly-slider-thumb-fill: var(--jolly-danger-border);
  }

  :host([readonly]) .lane {
    --jolly-slider-groove: var(--jolly-control-bg-muted);
  }

  /*
   * Override native range track and thumb rendering. The input contributes hit
   * area and the knob; the lane draws everything else.
   */
  .value input[type="range"] {
    position: absolute;
    inset: 0 var(--jolly-slider-inset);
    width: auto;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    appearance: none;
    cursor: pointer;
  }

  /*
   * The shared field rules match "input" generically and outrank a plain
   * type selector, so the range would otherwise pick up the control fill on
   * hover, focus, invalid and readonly. The range paints nothing in any state.
   */
  .value input[type="range"]:hover:not(:disabled),
  .value input[type="range"]:focus,
  .value input[type="range"]:focus-visible,
  :host([invalid]) .value input[type="range"],
  :host([readonly]) .value input[type="range"] {
    background: none;
    outline: none;
  }

  .value input[type="range"]::-webkit-slider-runnable-track {
    height: 100%;
    background: none;
  }

  .value input[type="range"]::-moz-range-track {
    height: 100%;
    background: none;
  }

  /* The handle keeps equal dimensions when focus grows its square shape. */
  .value input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: var(--jolly-slider-knob, 10px);
    height: var(--jolly-slider-knob, 10px);
    margin-top: calc(
      (var(--jolly-control-height, 20px) - var(--jolly-slider-knob, 10px)) / 2
    );
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-slider-thumb-fill);
    transition:
      background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      width var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      height var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .value input[type="range"]::-moz-range-thumb {
    width: var(--jolly-slider-knob, 10px);
    height: var(--jolly-slider-knob, 10px);
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-slider-thumb-fill);
    transition:
      background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      width var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      height var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  /*
   * Mixed values have no thumb position.
   */
  :host([mixed]) .lane {
    opacity: 0.35;
    pointer-events: none;
  }

  /*
   * A fixed readout column keeps the lane's right edge aligned down the pane.
   */
  .value input.readout {
    flex: 0 0 auto;
    width: 6ch;
    min-width: 0;
    text-align: right;
  }

  :host([disabled]) .value input[type="range"] {
    cursor: default;
  }
`;
