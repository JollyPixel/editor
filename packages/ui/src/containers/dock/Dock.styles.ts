// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../../theme/styles/fallbacks.ts";
import {
  contentScrollbar,
  focusRing
} from "../../theme/styles/mixins.ts";

export const dockStyles = css`
  :host {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: var(--jolly-dock-size, 240px);
    height: 100%;
    min-width: 0;
    min-height: 0;
    border-radius: 0;
    background: var(--jolly-surface, ${kFallback.controlBg});
    pointer-events: auto;
  }

  :host([align]) {
    text-align: inherit;
  }

  :host([side="top"]),
  :host([side="bottom"]) {
    width: 100%;
    height: var(--jolly-dock-size, 240px);
  }

  :host([empty]:not([overlay])) {
    background: none;
  }

  :host([overlay]) {
    position: fixed;
    width: var(--jolly-dock-size, 240px);
    height: auto;
    background: none;
    pointer-events: none !important;
  }

  :host([overlay][side="left"]),
  :host([overlay][side="right"]) {
    inset-block: 0;
  }

  :host([overlay][side="top"]),
  :host([overlay][side="bottom"]) {
    inset-inline: 0;
    width: auto;
  }

  :host([overlay][side="left"]) {
    inset-inline-start: 0;
  }

  :host([overlay][side="right"]) {
    inset-inline-end: 0;
  }

  :host([overlay][side="top"]) {
    inset-block-start: 0;
  }

  :host([overlay][side="bottom"]) {
    inset-block-end: 0;
  }

  .column {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .secondary {
    display: none;
  }

  :host([split]) {
    display: flex;
  }

  :host([split][side="right"]) {
    flex-direction: row-reverse;
  }

  :host([split]) .column {
    flex: 1 1 0;
    min-width: 0;
  }

  :host([split]) .secondary {
    display: flex;
    box-shadow: inset 1px 0 0
      var(--jolly-border, ${kFallback.borderStrong});
  }

  :host([split][side="right"]) .secondary {
    box-shadow: inset -1px 0 0
      var(--jolly-border, ${kFallback.borderStrong});
  }

  ${contentScrollbar}

  :host([align][side="left"]:not([overlay])) .column,
  :host([align][side="right"]:not([overlay])) .column {
    overflow-y: auto;
    padding-block-end: var(--jolly-dock-scroll-gutter, 8px);
  }

  :host([align][side="top"]:not([overlay])) .column,
  :host([align][side="bottom"]:not([overlay])) .column {
    overflow-x: auto;
    padding-inline-end: var(--jolly-dock-scroll-gutter, 8px);
  }

  :host([side="top"]) .column,
  :host([side="bottom"]) .column {
    flex-direction: row;
  }

  :host([overlay]) .column {
    overflow: visible;
    gap: var(--jolly-dock-gap, 8px);
    padding: var(--jolly-dock-gap, 8px);
  }

  :host([overlay]) .resize-handle {
    background: transparent;
    pointer-events: auto;
  }

  :host([empty]) .resize-handle {
    display: none;
  }

  :host([overlay]) .resize-handle::after {
    display: none;
  }

  :host([overlay]) .resize-handle:hover,
  :host([overlay]) .resize-handle:active,
  :host([overlay]) .resize-handle:focus-visible {
    background: transparent;
  }

  :host([overlay][align][side="left"]) .column,
  :host([overlay][align][side="right"]) .column {
    overflow-y: auto;
  }

  :host([align="start"]) .column {
    justify-content: flex-start;
  }

  :host([align="end"]) .column {
    justify-content: flex-end;
  }

  ::slotted(jolly-pane),
  ::slotted(jolly-pane-group) {
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  :host(:not([align])) ::slotted(jolly-pane),
  :host(:not([align])) ::slotted(jolly-pane-group) {
    flex: 1 1 auto;
    min-height: 0;
  }

  :host([align]) ::slotted(jolly-pane),
  :host([align]) ::slotted(jolly-pane-group) {
    flex: 0 0 auto;
    height: auto;
  }

  :host([align][side="top"]) ::slotted(jolly-pane),
  :host([align][side="top"]) ::slotted(jolly-pane-group),
  :host([align][side="bottom"]) ::slotted(jolly-pane),
  :host([align][side="bottom"]) ::slotted(jolly-pane-group) {
    width: auto;
    height: 100%;
  }

  :host([align]) ::slotted(jolly-pane[grow]) {
    flex: 1 1 auto;
    min-height: 0;
  }

  :host([overlay]) ::slotted(jolly-pane),
  :host([overlay]) ::slotted(jolly-pane-group) {
    height: auto;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised, ${kFallback.controlBg});
    box-shadow: var(--jolly-shadow-overlay, 0 2px 8px rgb(0 0 0 / 30%));
  }

  :host([collapsed]) .column {
    visibility: hidden;
  }

  .resize-handle {
    position: absolute;
    z-index: 1;
    border: 0;
    background: var(
      --jolly-dock-resize-bg,
      color-mix(in oklab, ${kFallback.focusRing} 12%, transparent)
    );
    touch-action: none;
    transition: background-color var(--jolly-duration-base, 160ms)
      var(--jolly-easing, ease);
  }

  .resize-handle::after {
    position: absolute;
    background-image: radial-gradient(
      circle,
      var(--jolly-groove) 1.1px,
      transparent 1.3px
    );
    content: "";
    pointer-events: none;
  }

  .resize-handle:hover::after,
  .resize-handle:active::after,
  .resize-handle:focus-visible::after {
    background-image: radial-gradient(
      circle,
      var(--jolly-accent-text, ${kFallback.focusRing}) 1.1px,
      transparent 1.3px
    );
  }

  .resize-handle:hover,
  .resize-handle:active,
  .resize-handle:focus-visible {
    background: var(
      --jolly-dock-resize-bg-hover,
      color-mix(in oklab, ${kFallback.focusRing} 18%, transparent)
    );
  }

  :host([side="left"]) .resize-handle,
  :host([side="right"]) .resize-handle {
    top: 0;
    bottom: 0;
    width: var(--jolly-dock-handle-size, 4px);
    cursor: ew-resize;
  }

  :host([side="left"]) .resize-handle {
    right: calc(-1 * var(--jolly-dock-handle-size, 4px));
  }

  :host([side="right"]) .resize-handle {
    left: calc(-1 * var(--jolly-dock-handle-size, 4px));
  }

  :host(:is([collapsed], :not([overlay]))[side="left"]) .resize-handle {
    right: 0;
  }

  :host(:is([collapsed], :not([overlay]))[side="right"]) .resize-handle {
    left: 0;
  }

  :host([side="left"]) .resize-handle::after,
  :host([side="right"]) .resize-handle::after {
    top: 50%;
    left: 50%;
    width: 3px;
    height: 22px;
    background-repeat: repeat-y;
    background-size: 100% 7px;
    transform: translate(-50%, -50%);
  }

  :host([side="top"]) .resize-handle,
  :host([side="bottom"]) .resize-handle {
    right: 0;
    left: 0;
    height: var(--jolly-dock-handle-size, 4px);
    cursor: ns-resize;
  }

  :host([side="top"]) .resize-handle {
    bottom: calc(-1 * var(--jolly-dock-handle-size, 4px));
  }

  :host([side="bottom"]) .resize-handle {
    top: calc(-1 * var(--jolly-dock-handle-size, 4px));
  }

  :host(:is([collapsed], :not([overlay]))[side="top"]) .resize-handle {
    bottom: 0;
  }

  :host(:is([collapsed], :not([overlay]))[side="bottom"]) .resize-handle {
    top: 0;
  }

  :host([side="top"]) .resize-handle::after,
  :host([side="bottom"]) .resize-handle::after {
    top: 50%;
    left: 50%;
    width: 22px;
    height: 3px;
    background-repeat: repeat-x;
    background-size: 7px 100%;
    transform: translate(-50%, -50%);
  }

  .resize-handle:focus-visible {
    ${focusRing}
    outline-offset: -3px;
  }
`;
