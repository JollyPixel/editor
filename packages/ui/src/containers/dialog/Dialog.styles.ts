// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../../theme/styles/fallbacks.ts";
import {
  fillTransition,
  headerTexture,
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
    --jolly-dialog-backdrop: color-mix(
      in oklab,
      var(--jolly-dialog-header-bg, ${kFallback.paneHeaderBg}) 28%,
      light-dark(rgb(30 38 52 / 46%), rgb(5 10 18 / 62%))
    );

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
    background: transparent;
    box-shadow: var(--jolly-shadow-modal, 0 12px 40px rgb(0 0 0 / 40%));
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
  }

  dialog:focus,
  dialog:focus-visible {
    outline: none;
  }

  dialog::backdrop {
    background: var(--jolly-dialog-backdrop);
    backdrop-filter: blur(2px);
  }

  ${overlayMotion}

  @media not (forced-colors: active) {
    :host([intent="info"]) {
      --jolly-dialog-header-bg: var(--jolly-intent-info-fill);
    }

    :host([intent="success"]) {
      --jolly-dialog-header-bg: var(--jolly-intent-success-fill);
    }

    :host([intent="warning"]) {
      --jolly-dialog-header-bg: var(--jolly-intent-warning-fill);
    }

    :host([intent="danger"]) {
      --jolly-dialog-header-bg: var(--jolly-intent-danger-fill);
    }
  }

  header {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--jolly-space-2, 8px);
    min-height: var(--jolly-row-height, 20px);
    overflow: hidden;
    padding: var(--jolly-dialog-chrome-padding);
    background: var(
      --jolly-dialog-header-bg,
      ${kFallback.paneHeaderBg}
    );
    color: var(--jolly-text-on-fill, white);
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  header::before {
    ${headerTexture}
  }

  .icon {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;

    --jolly-icon-size: 14px;
    --jolly-surface: var(--jolly-dialog-header-bg);
    --jolly-icon-tone-strength: var(--jolly-icon-tone-engaged, 100%);
  }

  :host([toned]) .icon,
  :host([intent]:not([intent=""])) .icon {
    --jolly-icon-tone-strength: 0%;
  }

  .title {
    position: relative;
    z-index: 1;
    flex: 1 1 auto;
    min-width: 0;

    ${truncate}
  }

  .heading {
    display: block;
    width: auto;
    max-width: 100%;
    min-width: 6ch;
    height: var(--jolly-row-height, 20px);
    position: relative;
    z-index: 1;
    field-sizing: content;
    padding: 0 var(--jolly-space-1, 4px);
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: rgb(255 255 255 / 12%);
    color: inherit;
    font: inherit;
    letter-spacing: inherit;

    ${truncate}

    ${fillTransition}
  }

  .heading:hover {
    background: rgb(255 255 255 / 18%);
  }

  .heading:focus {
    background: rgb(255 255 255 / 26%);
    outline: none;
  }

  @media (forced-colors: active) {
    :host {
      --jolly-dialog-backdrop: rgb(0 0 0 / 55%);
    }

    header::before {
      display: none;
    }
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
    background: var(--jolly-dialog-chrome-bg);
  }

  .body[inert] {
    opacity: 0.45;
  }

  slot[hidden] {
    display: none;
  }

  footer.danger {
    background: color-mix(
      in oklab,
      var(--jolly-intent-danger-fill) 14%,
      var(--jolly-dialog-chrome-bg)
    );
  }

  .confirmation {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--jolly-space-2, 8px);
    min-width: 0;
  }

  .message {
    flex: 1 1 24ch;
    margin: 0;
    line-height: 1.4;
  }
`;
