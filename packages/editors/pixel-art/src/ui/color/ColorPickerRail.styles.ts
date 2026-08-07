// Import Third-party Dependencies
import { css } from "lit";

/*
 * Self-contained 44x44 box so rail gaps stay visually symmetric.
 */
export const colorPickerRailStyles = css`
  :host {
    position: relative;
    display: block;
    width: 44px;
    height: 44px;
  }

  .swatch {
    position: absolute;
  }
  .swatch.fg {
    top: 4px;
    left: 0;
    z-index: 2;
  }
  .swatch.bg {
    right: 0;
    bottom: 0;
    z-index: 1;
  }
  .swatch::part(swatch) {
    width: 24px;
    height: 24px;
  }

  .swap-btn {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--color-bg-control);
    color: var(--color-text-emphasis);
    font-size: 9px;
    line-height: 1;
    cursor: pointer;
  }
  .swap-btn:hover {
    background: var(--color-accent);
  }
  .swap-btn .icon {
    width: 11px;
    height: 11px;
  }
`;
