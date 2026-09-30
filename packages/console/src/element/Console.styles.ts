// Import Third-party Dependencies
import { css } from "lit";

export const consoleStyles = css`
  :host {
    --jolly-console-width: min(640px, calc(100vw - 32px));
    --jolly-console-top: 30vh;
    --jolly-console-row: calc(var(--jolly-row-height, 20px) + 4px);
    --jolly-console-bg: var(--jolly-surface-raised, #2b2f36);
    --jolly-console-radius: 4px;
    --jolly-console-footer-bg: light-dark(
      var(--jolly-surface-sunken, rgb(0 0 0 / 12%)),
      color-mix(in oklab, var(--jolly-console-bg) 86%, black)
    );
    --jolly-console-shadow:
      0 1px 2px light-dark(rgb(0 0 0 / 6%), rgb(0 0 0 / 0%)),
      0 4px 8px light-dark(rgb(0 0 0 / 6%), rgb(0 0 0 / 6%)),
      0 12px 24px light-dark(rgb(0 0 0 / 8%), rgb(0 0 0 / 14%)),
      0 24px 48px light-dark(rgb(0 0 0 / 10%), rgb(0 0 0 / 28%));

    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  dialog {
    width: 100vw;
    max-width: none;
    height: 100vh;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--jolly-text, #e6e6e6);
    font: inherit;
  }

  dialog,
  dialog::backdrop {
    transition:
      opacity var(--jolly-duration-exit, 150ms) var(--jolly-easing-overlay, ease-out),
      overlay var(--jolly-duration-exit, 150ms) allow-discrete,
      display var(--jolly-duration-exit, 150ms) allow-discrete;
  }

  dialog[open],
  dialog[open]::backdrop {
    transition-duration: var(--jolly-duration-enter, 250ms);
  }

  dialog:focus,
  dialog:focus-visible {
    outline: none;
  }

  dialog::backdrop {
    background: light-dark(rgb(30 38 52 / 32%), rgb(5 10 18 / 48%));
    opacity: 0;
  }

  dialog[open]::backdrop {
    opacity: 1;
  }

  .card {
    position: absolute;
    top: var(--jolly-console-top);
    right: 0;
    left: 0;
    width: var(--jolly-console-width);
    margin-inline: auto;
    border-radius: var(--jolly-console-radius);
    box-shadow: var(--jolly-console-shadow);
    opacity: 0;
    transform: translateY(-6px) scale(var(--jolly-overlay-scale, 0.96));
    transform-origin: top center;
    transition:
      opacity var(--jolly-duration-exit, 150ms) var(--jolly-easing-overlay, ease-out),
      transform var(--jolly-duration-exit, 150ms) var(--jolly-easing-overlay, ease-out),
      border-radius var(--jolly-duration-base, 160ms) var(--jolly-easing, ease);
  }

  dialog[open] .card {
    opacity: 1;
    transform: none;
    transition-duration:
      var(--jolly-duration-enter, 250ms),
      var(--jolly-duration-enter, 250ms),
      var(--jolly-duration-base, 160ms);
  }

  @starting-style {
    dialog[open]::backdrop {
      opacity: 0;
    }

    dialog[open] .card {
      opacity: 0;
      transform: translateY(-6px) scale(var(--jolly-overlay-scale, 0.96));
    }
  }

  .has-log {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  .body {
    position: relative;
    z-index: 1;
    overflow: clip;
    border-radius: inherit;
    background: var(--jolly-console-bg);
  }

  .prompt {
    display: flex;
    gap: var(--jolly-space-2, 8px);
    align-items: center;
    height: calc(var(--jolly-console-row) + 12px);
    padding: 0 var(--jolly-space-3, 12px);
    box-shadow: inset 0 1px 3px light-dark(rgb(0 0 0 / 6%), rgb(0 0 0 / 22%));
  }

  .prompt jolly-icon {
    flex: 0 0 auto;
    color: var(--jolly-text-muted, #9aa0a6);

    --jolly-icon-size: 14px;
  }

  .field {
    display: flex;
    position: relative;
    flex: 1 1 auto;
    align-items: center;
    min-width: 0;
    font-size: calc(var(--jolly-font-size, 11px) + 2px);
  }

  input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  input::placeholder {
    color: var(--jolly-text-muted, #9aa0a6);
  }

  .ghost {
    display: flex;
    position: absolute;
    inset: 0;
    align-items: center;
    overflow: hidden;
    color: var(--jolly-text-muted, #9aa0a6);
    white-space: pre;
    pointer-events: none;
  }

  .ghost[hidden] {
    display: none;
  }

  .ghost .typed {
    visibility: hidden;
  }

  .hint {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    color: var(--jolly-text-muted, #9aa0a6);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .suggestions {
    display: grid;
    grid-template-rows: minmax(0, 0fr);
    overflow: clip;
    transition: grid-template-rows var(--jolly-duration-base, 160ms) var(--jolly-easing, ease);
  }

  .suggestions.expanded {
    grid-template-rows: minmax(0, 1fr);
  }

  [role="listbox"] {
    max-height: calc(var(--jolly-console-row) * 12);
    margin: 0;
    overflow-y: auto;
    padding: var(--jolly-space-1, 4px) 0;
    border-top: 1px solid var(--jolly-divider, rgb(255 255 255 / 8%));
    list-style: none;
    scrollbar-color: var(--jolly-groove, rgb(255 255 255 / 20%)) transparent;
    scrollbar-width: thin;
  }

  [role="option"] {
    display: flex;
    gap: var(--jolly-space-3, 12px);
    align-items: center;
    min-height: var(--jolly-console-row);
    padding: 0 var(--jolly-space-3, 12px);
    box-sizing: border-box;
    cursor: pointer;
    transition:
      background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  [role="option"][aria-selected="true"] {
    background: var(--jolly-accent-fill, #3b82f6);
    color: var(--jolly-text-on-fill, white);
  }

  [role="option"]:not([aria-selected="true"]):hover {
    background: var(--jolly-control-bg-hover, rgb(255 255 255 / 6%));
  }

  .label {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .label mark {
    background: none;
    color: inherit;
    font-weight: 700;
    text-decoration: underline;
  }

  .detail {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    opacity: 0.7;
    text-align: end;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .group + .group {
    margin-top: var(--jolly-space-1, 4px);
  }

  .group-title {
    padding: var(--jolly-space-1, 4px) var(--jolly-space-3, 12px) 2px;
    color: var(--jolly-text-muted, #9aa0a6);
    font-size: calc(var(--jolly-font-size, 11px) - 1px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .rows,
  .chips {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--jolly-space-1, 4px);
    padding: 2px var(--jolly-space-3, 12px) var(--jolly-space-1, 4px);
  }

  .chips [role="option"] {
    gap: var(--jolly-space-2, 8px);
    padding: 0 var(--jolly-space-2, 8px);
    border: 1px solid var(--jolly-border, rgb(255 255 255 / 12%));
    border-radius: var(--jolly-radius-sm, 4px);
  }

  .box {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    border: 1px solid currentcolor;
    border-radius: 2px;
    opacity: 0.8;

    --jolly-icon-size: 10px;
  }

  .usage {
    display: flex;
    gap: var(--jolly-space-3, 12px);
    align-items: baseline;
    min-height: var(--jolly-console-row);
    padding: var(--jolly-space-1, 4px) var(--jolly-space-3, 12px);
    border-top: 1px solid var(--jolly-divider, rgb(255 255 255 / 8%));
    box-sizing: border-box;
  }

  .signature {
    flex: 0 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .usage .description {
    flex: 1 1 auto;
    min-width: 0;
    color: var(--jolly-text-muted, #9aa0a6);
    text-align: end;
  }

  .keys {
    display: flex;
    flex-wrap: wrap;
    gap: var(--jolly-space-1, 4px) var(--jolly-space-3, 12px);
    padding: var(--jolly-space-1, 4px) var(--jolly-space-3, 12px);
    border-top: 1px solid var(--jolly-divider, rgb(255 255 255 / 8%));
    background: var(--jolly-console-footer-bg);
    background-clip: padding-box;
    color: var(--jolly-text-muted, #9aa0a6);
    font-size: calc(var(--jolly-font-size, 11px) - 1px);
  }

  .key-hint {
    display: inline-flex;
    gap: var(--jolly-space-1, 4px);
    align-items: center;
  }

  kbd {
    padding: 0 4px;
    border: 1px solid var(--jolly-border, rgb(255 255 255 / 12%));
    border-radius: var(--jolly-radius-sm, 4px);
    background: var(--jolly-control-bg, rgb(255 255 255 / 4%));
    color: var(--jolly-text, #e6e6e6);
    font: inherit;
  }

  [hidden] {
    display: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    dialog,
    dialog::backdrop,
    .card,
    .suggestions,
    [role="option"] {
      transition: none;
    }
  }
`;
