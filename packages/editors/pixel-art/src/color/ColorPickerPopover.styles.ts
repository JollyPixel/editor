// Import Third-party Dependencies
import { css } from "lit";

export const colorPickerPopoverStyles = css`
  :host {
    display: contents;
  }

  .popover {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: var(--jolly-space-1, 4px);
    overflow: visible;
    border: none;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--color-bg-surface, Canvas);
    box-shadow: var(--jolly-shadow-overlay);
    color: var(--jolly-text, CanvasText);
    font-family: var(--jolly-font-family, ui-monospace, monospace);
  }

  .done {
    display: block;
    margin: 8px 0 0 auto;
    color: inherit;
    background: transparent;
    border: 1px solid var(--color-divider);
    border-radius: 4px;
    cursor: pointer;
  }
`;
