// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import {
  focusRing,
  iconButton
} from "../theme/styles/mixins.ts";

export const notificationsStyles = css`
  :host {
    --jolly-notifications-inset: var(--jolly-space-3, 12px);
    --jolly-notifications-width: 320px;
    --jolly-notifications-gap: var(--jolly-space-2, 8px);
    --jolly-notifications-enter-duration: var(--jolly-duration-enter, 160ms);
    --jolly-notifications-exit-duration: var(--jolly-duration-exit, 160ms);
    --jolly-notifications-easing: var(--jolly-easing, ease);
    --jolly-notifications-rise: 8px;

    position: fixed;
    z-index: 1000;
    inset: auto;
    display: flex;
    flex-direction: column;
    width: min(
      var(--jolly-notifications-width),
      calc(100vw - 2 * var(--jolly-notifications-inset))
    );
    height: auto;
    max-height: calc(100vh - 2 * var(--jolly-notifications-inset));
    margin: 0;
    padding: 0;
    overflow: visible;
    border: 0;
    background: transparent;
    color: var(--jolly-text, #e6edf3);
    font-family: var(--jolly-font-family, system-ui);
    font-size: var(--jolly-font-size, 13px);
    line-height: 1.35;
    pointer-events: none;
  }

  :host([placement^="top"]) {
    inset-block-start: var(--jolly-notifications-inset);
  }

  :host([placement^="bottom"]) {
    flex-direction: column-reverse;
    inset-block-end: var(--jolly-notifications-inset);
  }

  :host([placement$="start"]) {
    inset-inline-start: var(--jolly-notifications-inset);
  }

  :host([placement$="end"]) {
    inset-inline-end: var(--jolly-notifications-inset);
  }

  .row {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    opacity: 1;
    transform: translateY(0);
    transition:
      grid-template-rows var(--jolly-notifications-enter-duration)
        var(--jolly-notifications-easing),
      opacity var(--jolly-notifications-enter-duration)
        var(--jolly-notifications-easing),
      transform var(--jolly-notifications-enter-duration)
        var(--jolly-notifications-easing);
  }

  :host([placement^="top"]) .row {
    --jolly-notifications-from: calc(-1 * var(--jolly-notifications-rise));
  }

  :host([placement^="bottom"]) .row {
    --jolly-notifications-from: var(--jolly-notifications-rise);
  }

  .slot {
    display: flow-root;
    min-height: 0;
    overflow: clip;
  }

  @starting-style {
    .row {
      grid-template-rows: minmax(0, 0fr);
      opacity: 0;
      transform: translateY(var(--jolly-notifications-from));
    }
  }

  .row.leaving {
    grid-template-rows: minmax(0, 0fr);
    opacity: 0;
    transition-duration: var(--jolly-notifications-exit-duration);
    pointer-events: none;
  }

  .chip {
    --jolly-notification-tone: var(--jolly-accent-fill, #48f);

    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--jolly-space-2, 8px);
    align-items: start;
    margin-block-start: var(--jolly-notifications-gap);
    padding: var(--jolly-space-2, 8px) var(--jolly-space-2, 8px)
      var(--jolly-space-2, 8px) var(--jolly-space-3, 12px);
    overflow: hidden;
    border: 1px solid var(--jolly-border, rgb(255 255 255 / 12%));
    border-inline-start: 3px solid var(--jolly-notification-tone);
    border-radius: var(--jolly-radius-md, 4px);
    background: var(--jolly-surface-raised, #222);
    box-shadow: var(--jolly-shadow-floating, 0 4px 12px rgb(0 0 0 / 35%));
    pointer-events: auto;
  }

  :host([placement^="bottom"]) .chip {
    margin-block: 0 var(--jolly-notifications-gap);
  }

  .chip[data-tone="success"] {
    --jolly-notification-tone: var(--jolly-success, #3c9);
  }

  .chip[data-tone="warning"] {
    --jolly-notification-tone: var(--jolly-warning, #fb3);
  }

  .chip[data-tone="error"] {
    --jolly-notification-tone: var(--jolly-danger, #f55);
  }

  .mark {
    display: inline-flex;
    align-items: center;
    height: 1lh;
    color: var(--jolly-notification-tone);
  }

  .mark jolly-icon {
    --jolly-icon-size: 16px;
  }

  .mark jolly-spinner {
    --jolly-spinner-size: 14px;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .source {
    color: var(--jolly-text-muted, #9aa4af);
    font-size: 0.9em;
  }

  .title {
    font-weight: 600;
  }

  .message {
    color: var(--jolly-text-muted, #9aa4af);
    white-space: pre-line;
  }

  jolly-progress {
    margin-block-start: var(--jolly-space-1, 4px);
  }

  .close {
    width: 20px;
    height: 20px;
    color: var(--jolly-text-muted, #9aa4af);

    ${iconButton}
  }

  .close:hover {
    background: var(--jolly-control-bg-hover);
    color: var(--jolly-text, #e6edf3);
  }

  .close:focus-visible {
    ${focusRing}
  }

  .close jolly-icon {
    --jolly-icon-size: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .row {
      transition: none;
    }
  }
`;
