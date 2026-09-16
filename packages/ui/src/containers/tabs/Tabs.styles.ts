// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../../theme/styles/fallbacks.ts";
import {
  focusRing,
  truncate
} from "../../theme/styles/mixins.ts";

export const tabsStyles = css`
  :host {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
  }

  :host([orientation="vertical"]) {
    flex-direction: row;
  }

  .list {
    display: flex;
    flex: 0 0 auto;
    gap: 1px;
  }

  :host([orientation="vertical"]) .list {
    flex-direction: column;
  }

  .item {
    position: relative;
    min-height: var(--jolly-control-height, 20px);
    display: flex;
    min-width: 0;
    flex: 0 0 auto;
    align-items: stretch;
    border-radius: var(--jolly-radius-sm, 2px) var(--jolly-radius-sm, 2px) 0 0;
    background: transparent;
    color: var(--jolly-text-muted, ${kFallback.text});
    text-align: center;
    transition:
      background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .item::after {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 2px;
    background: transparent;
    content: "";
  }

  .item:hover:not([data-disabled]) {
    background: var(--jolly-tab-bg-hover, ${kFallback.controlBg});
    color: var(--jolly-text, ${kFallback.text});
  }

  .item:has(button:focus-visible) {
    ${focusRing}

    outline-offset: -2px;
  }

  .item[data-selected] {
    background: var(--jolly-tab-selected-bg, ${kFallback.folderHeaderBg});
    color: var(--jolly-accent-text);
  }

  .item[data-selected]:hover {
    background: var(--jolly-tab-selected-bg-hover, ${kFallback.folderHeaderBgHover});
    color: var(--jolly-accent-text);
  }

  .item[data-selected]::after {
    background: var(--jolly-accent-fill);
  }

  .item[data-disabled] {
    opacity: 0.5;
  }

  :host([orientation="vertical"]) .item {
    border-radius: var(--jolly-radius-sm, 2px) 0 0 var(--jolly-radius-sm, 2px);
  }

  :host([orientation="vertical"]) .item::after {
    inset: 0 0 0 auto;
    width: 2px;
    height: auto;
  }

  button {
    padding: 0 var(--jolly-space-2, 8px);
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: none;
  }

  button:disabled {
    cursor: default;
  }

  .label {
    ${truncate}

    min-width: 0;
    flex: 1 1 auto;
  }

  :host(:not([orientation="vertical"])) .item[data-closable] .label {
    padding-inline-end: var(--jolly-space-1, 4px);
  }

  .close {
    display: inline-grid;
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
    padding: 0;
    border-radius: 50%;
    margin: auto var(--jolly-space-1, 4px) auto 0;
    place-items: center;
    color: inherit;
    opacity: 0.6;
    transition:
      background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      opacity var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .close jolly-icon {
    width: 8px;
    height: 8px;
  }

  .close:hover:not(:disabled) {
    background: var(--jolly-tab-close-bg-hover, ${kFallback.tabCloseBgHover});
    color: var(--jolly-tab-close-fg-hover, ${kFallback.inkDanger});
    opacity: 1;
  }

  .panels {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }
`;
