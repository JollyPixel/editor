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

  .strip {
    display: flex;
    min-width: 0;
    flex: 0 0 auto;
    align-items: stretch;
  }

  .list {
    display: flex;
    min-width: 0;
    flex: 0 1 auto;
    gap: 1px;
  }

  :host([orientation="vertical"]) .strip,
  :host([orientation="vertical"]) .list {
    flex-direction: column;
  }

  slot[name="list-end"] {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
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
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: var(--jolly-space-1, 4px);
  }

  .text {
    ${truncate}

    min-width: 0;
  }

  .badge {
    flex: 0 0 auto;
    min-width: 1ch;
    padding: 0 4px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-tab-badge-bg, ${kFallback.tabBadgeBg});
    color: var(--jolly-tab-badge-fg, ${kFallback.tabBadgeFg});
    font-size: 0.85em;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.5;
  }

  :host(:not([orientation="vertical"])) .item[data-closable] .label,
  :host(:not([orientation="vertical"])) .item[data-action] .label {
    padding-inline-end: var(--jolly-space-1, 4px);
  }

  .action {
    display: inline-grid;
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    padding: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    margin: auto var(--jolly-space-1, 4px) auto 0;
    place-items: center;
    color: inherit;
    opacity: 0.9;
    transition:
      background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      opacity var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .item:not([data-selected], [data-disabled]) .action {
    display: none;
  }

  .action jolly-icon {
    width: 14px;
    height: 14px;
  }

  .action:hover {
    background: var(--jolly-tab-bg-hover, ${kFallback.controlBg});
    opacity: 1;
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

  :host([variant="skew"]) {
    --jolly-tab-skew: 8px;
    --jolly-tab-skew-seam: 2px;
    --jolly-tab-skew-fill: var(--jolly-control-bg, ${kFallback.controlBg});
    --jolly-tab-skew-fill-hover: var(--jolly-control-bg-hover, ${kFallback.controlBg});
  }

  :host([variant="skew"]) .list {
    gap: 0;
  }

  :host([variant="skew"]) .item,
  :host([variant="skew"]) ::slotted([slot="list-end"]) {
    min-height: calc(var(--jolly-control-height, 20px) + 8px);
    box-sizing: border-box;
    padding-inline: var(--jolly-tab-skew);
    border-radius: 0;
    background: var(--jolly-tab-skew-fill);
    clip-path: polygon(
      var(--jolly-tab-skew) 0,
      100% 0,
      calc(100% - var(--jolly-tab-skew)) 100%,
      0 100%
    );
  }

  :host([variant="skew"]) .item + .item,
  :host([variant="skew"]) ::slotted([slot="list-end"]) {
    margin-inline-start: calc(
      var(--jolly-tab-skew-seam) - var(--jolly-tab-skew)
    );
  }

  :host([variant="skew"]) .item:hover:not([data-disabled]),
  :host([variant="skew"]) ::slotted([slot="list-end"]:hover) {
    background: var(--jolly-tab-skew-fill-hover);
  }

  :host([variant="skew"]) .item[data-selected] {
    background: var(--jolly-tab-selected-bg, ${kFallback.folderHeaderBg});
  }

  :host([variant="skew"]) .item[data-selected]:hover {
    background: var(--jolly-tab-selected-bg-hover, ${kFallback.folderHeaderBgHover});
  }

  :host([variant="skew"]) slot[name="list-end"] {
    align-items: stretch;
  }

  :host([variant="skew"]) ::slotted([slot="list-end"]) {
    display: inline-flex;
    align-items: center;

    --jolly-control-bg: transparent;
    --jolly-control-bg-hover: transparent;
    --jolly-control-bg-active: transparent;
  }

  .panels {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }
`;
