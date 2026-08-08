// Import Third-party Dependencies
import { css } from "lit";

export const panelStyles = css`
  :host {
    display: flex;
    flex-direction: row;
    height: 100%;
  }

  :host(:not([data-ready])) {
    visibility: hidden;
  }

  .rail {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 50px;
    flex-shrink: 0;
    padding: 20px 0;
    gap: 10px;
    background: var(--color-bg-surface);
    color: var(--color-text);
    font-family: sans-serif;
    user-select: none;
  }

  .rail-divider {
    width: 32px;
    height: 1px;
    flex-shrink: 0;
    background: var(--color-divider);
  }

  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .canvas-host {
    /*
     * PixelArtCanvas sets inline position:relative;
     * size via width/height.
     */
    width: 100%;
    height: 100%;
  }

  .tool-option-overlay {
    position: absolute;
    top: 8px;
    left: 50%;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--color-bg-overlay);
    color: var(--color-text);
    font-size: 11px;
    font-family: sans-serif;
    user-select: none;
    transform: translateX(-50%);
  }

  .brush-preview {
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-bg-overlay), 0 0 0 2px var(--color-accent);
    transition: width 0.08s ease, height 0.08s ease;
  }

  .tool-option-label {
    color: var(--color-text-muted);
  }

  .tool-option-value {
    width: 28px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .brush-size-slider {
    width: 100px;
    height: 14px;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    cursor: pointer;
  }

  .brush-size-slider:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }

  .brush-size-slider::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      var(--color-accent) 0%,
      var(--color-accent) var(--fill),
      var(--color-border) var(--fill),
      var(--color-border) 100%
    );
  }

  .brush-size-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border-radius: 50%;
    background: var(--color-accent);
    border: 2px solid var(--color-text-on-accent);
    cursor: pointer;
  }

  .brush-size-slider::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: var(--color-border);
  }

  .brush-size-slider::-moz-range-progress {
    height: 4px;
    border-radius: 2px;
    background: var(--color-accent);
  }

  .brush-size-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--color-accent);
    border: 2px solid var(--color-text-on-accent);
    cursor: pointer;
  }

  .overlay-toolbar {
    position: absolute;
    left: 50%;
    z-index: 2;
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 6px;
    background: var(--color-bg-overlay);
    color: var(--color-text);
    font-size: 11px;
    font-family: sans-serif;
    user-select: none;
    transform: translateX(-50%);
  }

  .overlay-toolbar.top {
    top: 8px;
  }

  .overlay-toolbar.bottom {
    bottom: 8px;
  }

  .overlay-toolbar > * + * {
    margin-left: 4px;
  }

  .overlay-toolbar .rail-btn {
    width: 26px;
    height: 26px;
  }

  .overlay-toolbar .icon {
    width: 16px;
    height: 16px;
  }

  .icon-with-badge {
    position: relative;
    display: flex;
    width: 16px;
    height: 16px;
  }

  .icon-badge {
    position: absolute;
    right: -3px;
    bottom: -3px;
    display: flex;
    width: 10px;
    height: 10px;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    background: var(--color-bg-overlay);
  }

  .overlay-toolbar .icon-badge .icon {
    width: 9px;
    height: 9px;
  }

  .overlay-toolbar.top .tooltip {
    left: 50%;
    top: calc(100% + 8px);
    bottom: auto;
    transform: translateX(-50%);
  }

  .overlay-toolbar.bottom .tooltip {
    left: 50%;
    top: auto;
    bottom: calc(100% + 8px);
    transform: translateX(-50%);
  }

  .overlay-toolbar-divider {
    width: 1px;
    height: 18px;
    flex-shrink: 0;
    background: var(--color-divider);
  }

  .file-input {
    display: none;
  }
`;
