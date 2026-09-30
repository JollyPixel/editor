// Import Third-party Dependencies
import { css } from "lit";

export const consoleStyles = css`
  :host {
    --jolly-console-width: min(640px, calc(100vw - 32px));
    --jolly-console-top: 30vh;
    --jolly-console-row: calc(var(--jolly-row-height, 20px) + 4px);
    --jolly-console-bg: var(--jolly-surface-raised, #2b2f36);

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
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-console-bg);
    box-shadow: var(--jolly-shadow-modal, 0 12px 40px rgb(0 0 0 / 40%));
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

  .scrollback {
    position: absolute;
    right: 0;
    bottom: 100%;
    left: 0;
    max-height: min(
      calc(var(--jolly-console-row) * 8),
      calc(var(--jolly-console-top) - 16px)
    );
    overflow-y: auto;
    padding: var(--jolly-space-1, 4px) 0;
    border-bottom: 1px solid var(--jolly-divider, rgb(255 255 255 / 8%));
    border-radius: var(--jolly-radius-md, 6px) var(--jolly-radius-md, 6px) 0 0;
    background: var(--jolly-console-bg);
    box-shadow: var(--jolly-shadow-modal, 0 12px 40px rgb(0 0 0 / 40%));
    transition: opacity var(--jolly-duration-base, 160ms) var(--jolly-easing, ease);
  }

  @starting-style {
    .scrollback {
      opacity: 0;
    }
  }

  .has-log {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  .entry {
    display: flex;
    gap: var(--jolly-space-2, 8px);
    align-items: baseline;
    min-height: var(--jolly-console-row);
    padding: 2px var(--jolly-space-3, 12px);
    box-sizing: border-box;
    transition:
      opacity var(--jolly-duration-base, 160ms) var(--jolly-easing, ease),
      transform var(--jolly-duration-base, 160ms) var(--jolly-easing, ease);
  }

  @starting-style {
    .entry {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  .entry .text {
    flex: 1 1 auto;
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .entry jolly-icon {
    flex: 0 0 auto;
    align-self: center;

    --jolly-icon-size: 10px;
  }

  .info {
    padding-inline-start: calc(var(--jolly-space-3, 12px) + 18px);
  }

  .echo {
    color: var(--jolly-text-muted, #9aa0a6);
  }

  .error {
    color: var(--jolly-danger, #ff6b6b);
  }

  .pending {
    color: var(--jolly-text-muted, #9aa0a6);
    animation: pending 1s ease-in-out infinite alternate;
  }

  @keyframes pending {
    from {
      opacity: 1;
    }

    to {
      opacity: 0.3;
    }
  }

  .prompt {
    display: flex;
    gap: var(--jolly-space-2, 8px);
    align-items: center;
    height: calc(var(--jolly-console-row) + 12px);
    padding: 0 var(--jolly-space-3, 12px);
  }

  .prompt jolly-icon {
    flex: 0 0 auto;
    color: var(--jolly-text-muted, #9aa0a6);

    --jolly-icon-size: 14px;
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
    font-size: calc(var(--jolly-font-size, 11px) + 2px);
  }

  input::placeholder {
    color: var(--jolly-text-muted, #9aa0a6);
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
    max-height: calc(var(--jolly-console-row) * 10);
    margin: 0;
    overflow-y: auto;
    padding: var(--jolly-space-1, 4px) 0;
    border-top: 1px solid var(--jolly-divider, rgb(255 255 255 / 8%));
    list-style: none;
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

  [hidden] {
    display: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    dialog,
    dialog::backdrop,
    .card,
    .scrollback,
    .entry,
    .suggestions,
    [role="option"] {
      transition: none;
    }

    .pending {
      animation: none;
    }
  }
`;
