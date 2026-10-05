// Import Third-party Dependencies
import { css } from "lit";

export const colorDockStyles = css`
  :host {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-width: 0;
    box-sizing: border-box;
    padding: 14px 16px;
    border-top: 1px solid var(--color-divider);
    background: var(--color-bg-surface);
    color: var(--color-text);
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: 11px;
  }

  jolly-color-picker {
    height: 100%;
    flex: 0 1 440px;
    min-width: 0;
  }
`;
