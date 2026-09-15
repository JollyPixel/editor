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

  .content {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  ${contentScrollbar}

  :host([align][side="left"]:not([overlay])) .content,
  :host([align][side="right"]:not([overlay])) .content {
    overflow-y: auto;
    padding-block-end: var(--jolly-dock-scroll-gutter, 8px);
  }

  :host([align][side="top"]:not([overlay])) .content,
  :host([align][side="bottom"]:not([overlay])) .content {
    overflow-x: auto;
    padding-inline-end: var(--jolly-dock-scroll-gutter, 8px);
  }

  :host([side="top"]) .content,
  :host([side="bottom"]) .content {
    flex-direction: row;
  }

  :host([overlay]) .content {
    overflow: visible;
    gap: var(--jolly-dock-gap, 8px);
    padding: var(--jolly-dock-gap, 8px);
  }

  :host([overlay]) .resize-handle {
    background: transparent;
    pointer-events: auto;
  }

  :host([overlay][empty]) .resize-handle {
    pointer-events: none;
  }

  :host([overlay]) .resize-handle::after {
    display: none;
  }

  :host([overlay]) .resize-handle:hover,
  :host([overlay]) .resize-handle:active,
  :host([overlay]) .resize-handle:focus-visible {
    background: transparent;
  }

  :host([overlay][align][side="left"]) .content,
  :host([overlay][align][side="right"]) .content {
    overflow-y: auto;
  }

  :host([align="start"]) .content {
    justify-content: flex-start;
  }

  :host([align="end"]) .content {
    justify-content: flex-end;
  }

  ::slotted(jolly-pane) {
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  :host(:not([align])) ::slotted(jolly-pane) {
    flex: 1 1 auto;
    min-height: 0;
  }

  :host([align]) ::slotted(jolly-pane) {
    flex: 0 0 auto;
    height: auto;
  }

  :host([align][side="top"]) ::slotted(jolly-pane),
  :host([align][side="bottom"]) ::slotted(jolly-pane) {
    width: auto;
    height: 100%;
  }

  :host([align]) ::slotted(jolly-pane[grow]) {
    flex: 1 1 auto;
    min-height: 0;
  }

  :host([overlay]) ::slotted(jolly-pane) {
    height: auto;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised, ${kFallback.controlBg});
    box-shadow: var(--jolly-shadow-overlay, 0 2px 8px rgb(0 0 0 / 0.3));
  }

  :host([collapsed]) .content {
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
    width: 4px;
    cursor: ew-resize;
  }

  :host([side="left"]) .resize-handle {
    right: -4px;
  }

  :host([side="right"]) .resize-handle {
    left: -4px;
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
    height: 4px;
    cursor: ns-resize;
  }

  :host([side="top"]) .resize-handle {
    bottom: -4px;
  }

  :host([side="bottom"]) .resize-handle {
    top: -4px;
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
