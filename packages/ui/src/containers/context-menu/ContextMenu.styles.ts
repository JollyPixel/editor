// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../../theme/styles/fallbacks.ts";
import {
  overlayMotion,
  truncate
} from "../../theme/styles/mixins.ts";

export const contextMenuStyles = css`
  :host {
    display: contents;
  }

  .menu {
    position: fixed;
    inset: auto;
    min-width: 160px;
    max-width: 320px;
    margin: 0;
    padding: var(--jolly-space-1, 4px);
    overflow: auto;
    border: none;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised, Canvas);
    box-shadow: var(--jolly-shadow-overlay);
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-2, 8px);
    width: 100%;
    min-height: var(--jolly-row-height, 20px);
    padding-inline: var(--jolly-space-2, 8px);
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: default;
  }

  .branch {
    display: contents;
  }

  .item:focus,
  .item[aria-expanded="true"] {
    outline: none;
    background: var(--jolly-control-bg-hover, ${kFallback.controlBg});
  }

  .item.danger {
    --jolly-icon-tone-strength: 0%;

    color: var(--jolly-danger);
  }

  .item.danger:focus {
    background: var(--jolly-invalid-bg-focus);
  }

  .item:disabled {
    color: var(--jolly-text-muted, ${kFallback.text});
    opacity: 0.6;
  }

  .icon,
  .chevron {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
  }

  .menu[data-opens="left"] > .branch > .item > .chevron {
    order: -1;
    transform: scaleX(-1);
  }

  .menu[data-opens="left"]:has(> .branch) > .item {
    padding-inline-start: calc(var(--jolly-space-2, 8px) * 2 + 12px);
  }

  .label {
    flex: 1 1 auto;
    min-width: 0;

    ${truncate}
  }

  .separator {
    height: 1px;
    margin: var(--jolly-space-1, 4px) 0;
    background: var(--jolly-divider);
  }

  ${overlayMotion}
`;
