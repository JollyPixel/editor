// Import Third-party Dependencies
import { css } from "lit";

export const colorPickerRailStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 36px;
    gap: 6px;
  }

  .swatches {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .swap-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--color-bg-control);
    color: var(--color-text-on-accent);
    font: inherit;
    font-size: 8px;
    line-height: 1;
    cursor: pointer;
    transform: translate(-50%, -50%);
    transition: opacity 0.12s ease, visibility 0.12s;
    box-shadow:
      0 0 0 2px var(--color-bg-surface),
      0 0 3px 2px var(--color-swatch-edge, transparent),
      0 1px 3px rgb(0 0 0 / 35%);
  }

  .swap-btn:hover:not(:disabled) {
    background: var(--color-accent);
  }

  .swap-btn:disabled {
    cursor: default;
  }

  .swatch.fg {
    z-index: 2;
  }

  .swatch.bg {
    z-index: 1;
    transition: margin-top 0.16s ease, opacity 0.16s ease, visibility 0.16s;
  }

  :host([docked]) .swatch.bg {
    margin-top: -30px;
    opacity: 0;
    visibility: hidden;
  }

  :host([docked]) .swap-btn {
    opacity: 0;
    visibility: hidden;
  }

  .swap-btn .icon {
    width: 10px;
    height: 10px;
  }

  .dock-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 14px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font: inherit;
  }

  .dock-btn:hover {
    color: var(--color-text-emphasis);
  }

  .dock-btn[aria-pressed="true"] {
    background: var(--color-accent);
    color: var(--color-text-on-accent);
  }

  .dock-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }

  .dock-btn .icon {
    width: 12px;
    height: 12px;
  }
`;
