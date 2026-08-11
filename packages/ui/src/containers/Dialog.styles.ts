// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/fallbacks.ts";

export const dialogStyles = css`
  :host {
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  /*
   * A dialog is a plane and a detached one, so it keeps its shadow. The border
   * is gone: elevation and the surface step already separate it from the page.
   */
  dialog {
    min-width: min(320px, calc(100vw - 32px));
    max-width: min(560px, calc(100vw - 32px));
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised, ${kFallback.controlBg});
    box-shadow: var(--jolly-shadow-modal, 0 12px 40px rgb(0 0 0 / 0.4));
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
  }

  dialog::backdrop {
    background: rgb(5 10 18 / 0.55);
    backdrop-filter: blur(2px);
  }

  /*
   * Group level structure keeps a divider, unlike the rows inside it.
   */
  header {
    padding: var(--jolly-space-3, 12px) var(--jolly-space-4, 16px);
    border-bottom: 1px solid var(--jolly-divider);
    letter-spacing: 0.05em;
  }

  .body {
    padding: var(--jolly-space-4, 16px);
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--jolly-space-2, 8px);
    padding: var(--jolly-space-3, 12px) var(--jolly-space-4, 16px);
    border-top: 1px solid var(--jolly-divider);
  }
`;
