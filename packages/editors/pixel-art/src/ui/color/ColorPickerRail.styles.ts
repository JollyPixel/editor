// Import Third-party Dependencies
import { css } from "lit";

/*
 * Fg/bg stacked at rail-btn's own 36px width, so the picker's side margins
 * match the mode buttons above it instead of a wider, one-off footprint.
 */
export const colorPickerRailStyles = css`
  :host {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 36px;
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
    font-size: 8px;
    line-height: 1;
    cursor: pointer;
    transform: translate(-50%, -50%);
    box-shadow:
      0 0 0 2px var(--color-bg-surface),
      0 0 3px 2px var(--color-swatch-edge, transparent),
      0 1px 3px rgba(0, 0, 0, 0.35);
  }
  .swap-btn:hover {
    background: var(--color-accent);
  }
  .swap-btn .icon {
    width: 10px;
    height: 10px;
  }
`;
