// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../../theme/styles/fallbacks.ts";
import {
  fillTransition,
  overlayMotion,
  truncate
} from "../../theme/styles/mixins.ts";

export const dialogStyles = css`
  :host {
    --jolly-dialog-chrome-bg: color-mix(
      in oklab,
      var(--jolly-ink) 4%,
      var(--jolly-surface-raised, ${kFallback.controlBg})
    );
    --jolly-dialog-chrome-padding: calc(var(--jolly-row-height, 20px) * 0.4);

    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  dialog {
    min-width: min(320px, calc(100vw - 32px));
    max-width: min(560px, calc(100vw - 32px));
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised, ${kFallback.controlBg});
    box-shadow: var(--jolly-shadow-modal, 0 12px 40px rgb(0 0 0 / 40%));
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
  }

  dialog:focus,
  dialog:focus-visible {
    outline: none;
  }

  dialog::backdrop {
    background: rgb(5 10 18 / 55%);
    backdrop-filter: blur(2px);
  }

  ${overlayMotion}

  header {
    display: flex;
    align-items: center;
    min-height: var(--jolly-row-height, 20px);
    padding: var(--jolly-dialog-chrome-padding);
    border-bottom: 1px solid var(--jolly-divider);
    background: var(--jolly-dialog-chrome-bg);
    letter-spacing: 0.05em;
  }

  .heading {
    display: block;
    width: auto;
    max-width: 100%;
    min-width: 6ch;
    height: var(--jolly-row-height, 20px);
    field-sizing: content;
    padding: 0 var(--jolly-space-1, 4px);
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg);
    color: inherit;
    font: inherit;
    letter-spacing: inherit;

    ${truncate}

    ${fillTransition}
  }

  .heading:hover {
    background: var(--jolly-control-bg-hover);
  }

  .heading:focus {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  .body {
    padding: var(--jolly-space-4, 16px);
    background: var(--jolly-surface-raised, ${kFallback.controlBg});
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--jolly-space-2, 8px);
    padding: var(--jolly-dialog-chrome-padding);
    border-top: 1px solid var(--jolly-divider);
  }
`;
