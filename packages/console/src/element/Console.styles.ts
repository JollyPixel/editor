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

  dialog:focus,
  dialog:focus-visible {
    outline: none;
  }

  dialog::backdrop {
    background: light-dark(rgb(30 38 52 / 32%), rgb(5 10 18 / 48%));
  }

  .card {
    position: absolute;
    top: var(--jolly-console-top);
    left: 50%;
    width: var(--jolly-console-width);
    transform: translateX(-50%);
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-console-bg);
    box-shadow: var(--jolly-shadow-modal, 0 12px 40px rgb(0 0 0 / 40%));
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
  }

  [role="option"][aria-selected="true"] {
    background: var(--jolly-accent-fill, #3b82f6);
    color: var(--jolly-accent-text, white);
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
`;
