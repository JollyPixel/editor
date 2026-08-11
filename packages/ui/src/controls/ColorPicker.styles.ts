// Import Third-party Dependencies
import { css } from "lit";

/**
 * Renders picker surfaces with gradients driven by custom properties.
 */
export const colorPickerStyles = css`
  :host {
    --jolly-picker-width: 180px;
    --jolly-picker-area-height: 110px;
    --jolly-picker-track-height: 12px;
    /* Centers a narrow ramp within the pointer hit area. */
    --jolly-picker-ramp-height: 4px;
    --jolly-picker-knob: 10px;
    --jolly-picker-checker: color-mix(in oklab, var(--jolly-ink) 18%, transparent);
    /* Hosts can set this to 0 when clipping the panel to their radius. */
    --jolly-picker-radius: var(--jolly-radius-md, 6px);

    display: block;
    width: var(--jolly-picker-width);
    color: var(--jolly-text, CanvasText);
    font-family: inherit;
    font-size: inherit;
  }

  :host([disabled]) {
    opacity: 0.5;
    pointer-events: none;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-space-1, 4px);
  }

  /* Checkerboard reveals alpha independently of the surface colour. */
  .checker {
    background-color: var(--jolly-surface-raised, Canvas);
    background-image: conic-gradient(
      var(--jolly-picker-checker) 25%,
      transparent 0 50%,
      var(--jolly-picker-checker) 0 75%,
      transparent 0
    );
    background-size: 8px 8px;
  }

  /*
   * Saturation runs left to right and value bottom to top. Resolve the hue here;
   * resolving it on :host before assignment paints every hue red.
   */
  .area {
    position: relative;
    height: var(--jolly-picker-area-height);
    border-radius: var(--jolly-picker-radius);
    background-image:
      linear-gradient(to top, #000, transparent),
      linear-gradient(
        to right,
        #fff,
        hsl(calc(var(--jolly-picker-hue, 0) * 1deg) 100% 50%)
      );
    cursor: crosshair;
    touch-action: none;
  }

  .area-cursor {
    position: absolute;
    left: calc(var(--jolly-picker-x, 0) * 100%);
    top: calc(var(--jolly-picker-y, 0) * 100%);
    width: var(--jolly-picker-knob);
    height: var(--jolly-picker-knob);
    box-sizing: border-box;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  /*
   * Hidden native ranges provide keyboard and screen-reader control for both
   * axes. Keep them focusable; display and visibility cannot hide them.
   */
  .axis {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    pointer-events: none;
  }

  /* Provides a large hit area around the narrow ramp. */
  .track {
    position: relative;
    height: var(--jolly-picker-track-height);
    touch-action: none;
  }

  .track::before {
    content: "";
    position: absolute;
    inset-inline: 0;
    top: 50%;
    height: var(--jolly-picker-ramp-height);
    border-radius: calc(var(--jolly-picker-ramp-height) / 2);
    transform: translateY(-50%);
    pointer-events: none;
    transition: height var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .track.hue::before {
    background-image: linear-gradient(
      to right,
      hsl(0 100% 50%),
      hsl(60 100% 50%),
      hsl(120 100% 50%),
      hsl(180 100% 50%),
      hsl(240 100% 50%),
      hsl(300 100% 50%),
      hsl(360 100% 50%)
    );
  }

  /* Composites the alpha ramp over the checkerboard on one element. */
  .track.alpha::before {
    background-color: var(--jolly-surface-raised, Canvas);
    background-image:
      linear-gradient(
        to right,
        transparent,
        var(--jolly-picker-opaque, #000)
      ),
      conic-gradient(
        var(--jolly-picker-checker) 25%,
        transparent 0 50%,
        var(--jolly-picker-checker) 0 75%,
        transparent 0
      );
    background-size: auto, 6px 6px;
  }

  .track:has(input:focus-visible) {
    --jolly-picker-ramp-height: 6px;
    --jolly-picker-knob: 12px;
  }

  .track input[type="range"] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    appearance: none;
    cursor: pointer;
  }

  .track input[type="range"]::-webkit-slider-runnable-track {
    height: 100%;
    background: none;
  }

  .track input[type="range"]::-moz-range-track {
    height: 100%;
    background: none;
  }

  /* Matches slider sizing; white remains visible across all hues. */
  .track input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: var(--jolly-picker-knob);
    height: var(--jolly-picker-knob);
    box-sizing: border-box;
    margin-top: calc(
      (var(--jolly-picker-track-height) - var(--jolly-picker-knob)) / 2
    );
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.45);
    transition:
      width var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      height var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .track input[type="range"]::-moz-range-thumb {
    width: var(--jolly-picker-knob);
    height: var(--jolly-picker-knob);
    box-sizing: border-box;
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.45);
    transition:
      width var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      height var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  /* Aligns the alpha readout with the slider value column. */
  .lane {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
  }

  .lane .track {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* Outline focus without altering the represented colour. */
  .area:has(input:focus-visible),
  .track:has(input:focus-visible) {
    outline: 2px solid var(--jolly-focus-ring, Highlight);
    outline-offset: 1px;
  }

  .footer {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
  }

  .preview {
    flex: 0 0 auto;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
    border-radius: var(--jolly-radius-sm, 2px);
  }

  .preview-face {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background: var(--jolly-picker-color, transparent);
  }

  .hex,
  .readout {
    height: var(--jolly-control-height, 20px);
    padding: 0 var(--jolly-space-1, 4px);
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg, ButtonFace);
    color: inherit;
    font: inherit;
    font-variant-numeric: tabular-nums;
  }

  .hex {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* Prevents ramp movement as the readout width changes. */
  .readout {
    flex: 0 0 auto;
    width: 4ch;
    text-align: right;
  }

  .hex:hover:not(:disabled),
  .readout:hover:not(:disabled) {
    background: var(--jolly-control-bg-hover);
  }

  .hex:focus-visible,
  .readout:focus-visible {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  .hex[aria-invalid="true"] {
    background: var(--jolly-invalid-bg);
    color: var(--jolly-danger, inherit);
  }

  :host([readonly]) .area,
  :host([readonly]) .track {
    cursor: default;
  }

  @media (forced-colors: active) {
    .area,
    .track {
      forced-color-adjust: none;
    }
  }
`;
