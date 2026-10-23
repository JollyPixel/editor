// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { focusRing } from "../theme/styles/mixins.ts";

export const colorPickerStyles = css`
  :host {
    --jolly-picker-width: 180px;
    --jolly-picker-area-height: 110px;
    --jolly-picker-area-max-width: 280px;
    --jolly-picker-wheel-size: 160px;
    --jolly-picker-track-height: 12px;
    --jolly-picker-ramp-height: 4px;
    --jolly-picker-knob: 10px;
    --jolly-picker-checker: color-mix(in oklab, var(--jolly-ink) 18%, transparent);
    --jolly-picker-radius: var(--jolly-radius-md, 6px);

    display: block;
    width: var(--jolly-picker-width);
    color: var(--jolly-text, CanvasText);
    font-family: inherit;
    font-size: inherit;
  }

  :host([layout="wide"]) {
    width: auto;
    height: 100%;
    min-height: 0;
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

  :host([layout="wide"]) .panel {
    flex-direction: row;
    align-items: stretch;
    justify-content: center;
    gap: var(--jolly-space-2, 8px);
    height: 100%;
  }

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

  .area {
    position: relative;
    height: var(--jolly-picker-area-height);
    border-radius: var(--jolly-picker-radius);
    cursor: crosshair;
    touch-action: none;
  }

  :host([layout="wide"]) .area {
    flex: 1 1 auto;
    min-width: 64px;
    max-width: var(--jolly-picker-area-max-width);
    height: auto;
  }

  .area.wheel {
    width: min(100%, var(--jolly-picker-wheel-size));
    height: auto;
    margin-inline: auto;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--jolly-surface-sunken, #808080);
  }

  :host([layout="wide"]) .area.wheel {
    flex: 0 0 auto;
    width: auto;
    min-width: 0;
    max-width: none;
    height: 100%;
    margin: 0;
  }

  .surface {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    pointer-events: none;
  }

  .harmony-marker {
    position: absolute;
    left: calc(var(--jolly-marker-x, 0) * 100%);
    top: calc(var(--jolly-marker-y, 0) * 100%);
    width: 6px;
    height: 6px;
    box-sizing: border-box;
    border: 1px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 50%);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .harmony {
    display: flex;
    gap: 2px;
  }

  .channels .harmony,
  .channels .settings {
    grid-column: 1 / -1;
  }

  .settings {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--jolly-space-1, 4px) var(--jolly-space-2, 8px);
  }

  :host([layout="wide"]) .settings {
    grid-template-columns: repeat(2, auto auto);
  }

  :host([layout="wide"]) .setting-select {
    width: 11ch;
  }

  .setting,
  .setting-check {
    display: contents;
  }

  .setting-name,
  .setting-check span {
    color: var(--jolly-text-muted, inherit);
  }

  .setting-check input {
    justify-self: end;
    margin: 0;
  }

  .setting-select {
    min-width: 0;
    height: var(--jolly-control-height, 20px);
    padding: 0 var(--jolly-space-1, 4px);
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg, ButtonFace);
    color: inherit;
    font: inherit;
  }

  .setting-select:focus-visible,
  .setting-check input:focus-visible {
    ${focusRing}
  }

  .settings-toggle {
    --jolly-icon-size: 14px;

    display: inline-grid;
    flex: 0 0 auto;
    place-items: center;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
    margin-inline-start: auto;
    padding: 0;
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: transparent;
    color: var(--jolly-text-muted, inherit);
    cursor: pointer;
  }

  .settings-toggle:hover,
  .settings-toggle[aria-expanded="true"] {
    background: var(--jolly-control-bg-hover, ButtonFace);
    color: inherit;
  }

  .settings-toggle:focus-visible {
    ${focusRing}
  }

  .harmony-swatch {
    flex: 1 1 0;
    min-width: 12px;
    height: var(--jolly-picker-track-height);
    padding: 0;
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-harmony-color, transparent);
    cursor: pointer;
  }

  .harmony-swatch:focus-visible {
    ${focusRing}
    outline-offset: 1px;
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
    box-shadow: 0 0 0 1px rgb(0 0 0 / 50%);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

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

  .track {
    position: relative;
    height: var(--jolly-picker-track-height);
    touch-action: none;
  }

  :host([layout="wide"]) .track {
    flex: 0 0 auto;
    width: var(--jolly-picker-track-height);
    height: auto;
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

  :host([layout="wide"]) .track::before {
    inset-inline: auto;
    top: 0;
    bottom: 0;
    left: 50%;
    width: var(--jolly-picker-ramp-height);
    height: auto;
    transform: translateX(-50%);
    transition: width var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .track.hue::before {
    background-image: linear-gradient(to right, var(--jolly-picker-hue-ramp));
  }

  .track.value::before {
    background-image: linear-gradient(to right, var(--jolly-picker-value-ramp));
  }

  :host([layout="wide"]) .track.hue::before {
    background-image: linear-gradient(to top, var(--jolly-picker-hue-ramp));
  }

  :host([layout="wide"]) .track.value::before {
    background-image: linear-gradient(to top, var(--jolly-picker-value-ramp));
  }

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

  :host([layout="wide"]) .track.alpha::before {
    background-image:
      linear-gradient(
        to top,
        transparent,
        var(--jolly-picker-opaque, #000)
      ),
      conic-gradient(
        var(--jolly-picker-checker) 25%,
        transparent 0 50%,
        var(--jolly-picker-checker) 0 75%,
        transparent 0
      );
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

  :host([layout="wide"]) .track input[type="range"] {
    writing-mode: vertical-lr;
    direction: rtl;
  }

  .track input[type="range"]::-webkit-slider-runnable-track {
    height: 100%;
    background: none;
  }

  :host([layout="wide"]) .track input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
  }

  .track input[type="range"]::-moz-range-track {
    height: 100%;
    background: none;
  }

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
    box-shadow: 0 1px 3px rgb(0 0 0 / 45%);
    transition:
      width var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      height var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  :host([layout="wide"]) .track input[type="range"]::-webkit-slider-thumb {
    margin-top: 0;
    margin-left: calc(
      (var(--jolly-picker-track-height) - var(--jolly-picker-knob)) / 2
    );
  }

  .track input[type="range"]::-moz-range-thumb {
    width: var(--jolly-picker-knob);
    height: var(--jolly-picker-knob);
    box-sizing: border-box;
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 45%);
    transition:
      width var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      height var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .lane {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
  }

  .lane .track {
    flex: 1 1 auto;
    min-width: 0;
  }

  .area:has(input:focus-visible),
  .track:has(input:focus-visible) {
    ${focusRing}
    outline-offset: 1px;
  }

  .footer {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
  }

  .channels {
    display: grid;
    flex: 0 0 auto;
    grid-template-columns: repeat(2, auto);
    align-content: space-between;
    gap: var(--jolly-space-1, 4px) var(--jolly-space-3, 12px);
    margin-inline-start: var(--jolly-space-2, 8px);
  }

  .channels .footer {
    grid-column: 1 / -1;
  }

  .channels .hex {
    width: 10ch;
  }

  .channel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--jolly-space-1, 4px);
  }

  .channel-name {
    width: 1ch;
    color: var(--jolly-text-muted, inherit);
    font-variant-numeric: tabular-nums;
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

  .readout {
    flex: 0 0 auto;
    width: 4ch;
    text-align: right;
  }

  .readout[data-channel="okc"] {
    width: 5ch;
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

  .hex[aria-invalid="true"],
  .readout[aria-invalid="true"] {
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

    .area:has(input:focus-visible),
    .track:has(input:focus-visible) {
      outline-color: Highlight;
    }
  }
`;
