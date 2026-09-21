// Import Third-party Dependencies
import { css } from "lit";

export const panelStyles = css`
  :host {
    display: flex;
    flex-direction: row;
    height: 100%;
    font-family: var(--jolly-font-family, ui-monospace, monospace);

    --color-bg-surface: light-dark(#eef3f8, #131b24);
    --color-bg-overlay: light-dark(rgb(255 255 255 / 92%), rgb(24 34 48 / 92%));
    --color-bg-tooltip: light-dark(#dbe7f2, #0d1520);
    --color-bg-control: light-dark(#20344c, #2a3b52);
    --color-border: light-dark(#6f8caa, #56708a);
    --color-divider: light-dark(#c5d7e6, #22303c);
    --color-text: light-dark(#16232f, #e8eef5);
    --color-text-muted: light-dark(#465a6e, #90a4b7);
    --color-text-emphasis: light-dark(#0b1420, #fff);
    --color-text-on-accent: #fff;
    --color-accent: var(--jolly-area-fill, light-dark(#2f6fd8, #3a6fc2));
    --color-canvas-bg: light-dark(#d7e3ee, #0d151d);
    --color-swatch-edge: light-dark(transparent, rgb(255 255 255 / 22%));
    --jolly-ink: var(--color-text);
    --jolly-text: var(--color-text);
    --jolly-surface-raised: var(--color-bg-overlay);
    --jolly-control-bg: var(--color-bg-surface);
    --jolly-control-bg-hover: var(--color-divider);
    --jolly-control-bg-focus: var(--color-border);
    --jolly-focus-ring: var(--color-accent);
  }

  :host([theme="auto"][data-ambient-theme="light"]) {
    color-scheme: light;
  }

  :host([theme="auto"][data-ambient-theme="dark"]) {
    color-scheme: dark;
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
    user-select: none;
  }

  .rail-divider {
    width: 32px;
    height: 1px;
    flex-shrink: 0;
    background: var(--color-divider);
  }

  .workspace {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: clip;
  }

  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .color-dock {
    flex: 0 0 140px;
    height: 140px;
    margin-bottom: -140px;
    visibility: hidden;
    transition:
      margin-bottom 0.2s cubic-bezier(0.2, 0, 0, 1),
      visibility 0.2s;
  }

  .color-dock[open] {
    margin-bottom: 0;
    visibility: visible;
  }

  @media (prefers-reduced-motion: reduce) {
    .color-dock {
      transition: none;
    }
  }

  .canvas-host {
    width: 100%;
    height: 100%;
  }

  .texture-host {
    width: 100%;
    height: 100%;
  }

  .texture-host[hidden] {
    display: none;
  }

  .texture-tabs {
    flex: 0 0 auto;
    min-width: 0;
    font-size: 12px;
    user-select: none;

    --texture-tab-height: calc(var(--jolly-control-height, 20px) + 8px);
  }

  .texture-tabs:not([variant="skew"]) {
    background: var(--color-bg-surface);
  }

  .texture-tabs::part(tab) {
    min-height: var(--texture-tab-height);
  }

  .texture-add {
    --jolly-control-height: var(--texture-tab-height);
  }

  .texture-tabs::part(list) {
    overflow-x: auto;
    scrollbar-width: thin;
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

  .tool-option-label,
  .tool-option-value {
    text-box: trim-both cap alphabetic;
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
    appearance: none;
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

  .overlay-toolbar .uv-state-trigger {
    width: auto;
    padding: 0 4px;
    gap: 1px;
  }

  .overlay-toolbar .uv-state-trigger .icon:last-child {
    width: 10px;
    height: 10px;
    opacity: 0.7;
  }

  .uv-state-menu {
    position: fixed;
    margin: 0;
    padding: 4px;
    border: 1px solid var(--color-divider);
    border-radius: 6px;
    background: var(--color-bg-overlay);
    color: inherit;
    inset: auto;
    overflow: visible;
  }

  .uv-state-option {
    display: flex;
    width: 100%;
    padding: 4px 8px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: inherit;
    cursor: pointer;
    font: inherit;
    gap: 6px;
    align-items: center;
    white-space: nowrap;
  }

  .uv-state-option .icon {
    width: 14px;
    height: 14px;
  }

  .uv-state-option:hover,
  .uv-state-option:focus-visible {
    background: var(--color-bg-hover);
  }

  .overlay-toolbar-divider {
    width: 1px;
    height: 18px;
    flex-shrink: 0;
    background: var(--color-divider);
  }

  .select-toolbar-row {
    position: absolute;
    top: 8px;
    left: 50%;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    transform: translateX(-50%);
  }

  .select-toolbar-row .overlay-toolbar {
    position: static;
    transform: none;
  }

  .clipboard-status,
  .drop-status {
    min-height: 1em;
    padding: 5px 8px;
    border-radius: 5px;
    background: var(--color-bg-overlay);
    color: var(--color-text);
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
  }

  .clipboard-status:empty,
  .drop-status:empty {
    display: none;
  }

  .stage-busy {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: color-mix(in srgb, var(--color-bg-surface) 72%, transparent);
    color: var(--color-text);
    font-size: 12px;
  }

  .stage-busy jolly-spinner {
    --jolly-spinner-size: 22px;
    --jolly-spinner-color: var(--color-accent);
  }

  .rail-btn jolly-spinner {
    --jolly-spinner-size: 18px;
  }

  .texture-drop-overlay {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 2px dashed var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 18%, transparent);
    color: var(--color-text);
    font-size: 12px;
    text-align: center;
    pointer-events: none;
  }

  .texture-drop-overlay .icon {
    width: 24px;
    height: 24px;
  }

  .drop-status {
    position: absolute;
    left: 50%;
    bottom: 44px;
    z-index: 2;
    transform: translateX(-50%);
  }

  .file-input {
    display: none;
  }
`;
