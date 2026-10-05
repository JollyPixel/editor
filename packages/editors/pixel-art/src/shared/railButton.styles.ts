// Import Third-party Dependencies
import { css } from "lit";

export const railButtonStyles = css`
  .rail-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font: inherit;
  }

  .rail-btn:hover:not(:disabled) {
    --jolly-icon-tone-strength: var(--jolly-icon-tone-engaged, 100%);

    color: var(--color-text-emphasis);
  }

  .rail-btn.active {
    --jolly-icon-tone-strength: 0%;

    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-text-on-accent);
  }

  .rail-btn.active:hover:not(:disabled) {
    --jolly-icon-tone-strength: 0%;

    color: var(--color-text-on-accent);
  }

  .rail-btn:disabled {
    --jolly-icon-tone-strength: 0%;

    color: var(--color-text-muted);
    opacity: 0.3;
    cursor: default;
  }

  .rail-btn.has-text {
    width: auto;
    gap: 2px;
    padding: 0 5px 0 3px;
  }

  .rail-text {
    font-size: 9px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
  }

  .rail-count {
    position: absolute;
    right: 1px;
    bottom: 1px;
    box-sizing: border-box;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 7px;
    background: var(--rail-count-bg, var(--color-accent));
    color: var(--color-bg-surface);
    font-size: 9.5px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 14px;
    text-align: center;
    pointer-events: none;
  }

  .rail-btn.active:disabled {
    color: var(--color-text-on-accent);
  }

  .rail-btn.has-flyout::after {
    content: "";
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 3px 0 3px 3.5px;
    border-color: transparent transparent transparent currentcolor;
    opacity: 0.8;
  }

  .rail-item {
    position: relative;
    display: flex;
    flex-shrink: 0;
  }

  .rail-flyout {
    position: absolute;
    left: 100%;
    top: 50%;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 0;
    padding: 0;
    overflow: hidden;
    border-radius: 0 6px 6px 0;
    background: var(--color-bg-surface);
    opacity: 0;
    pointer-events: none;
    white-space: nowrap;
    transform: translateY(-50%);
    transition: max-width 0.16s ease, padding 0.16s ease, opacity 0.12s ease;
  }

  .rail-item.open .rail-flyout,
  .rail-item:focus-within .rail-flyout {
    max-width: 48px;
    padding: 3px 6px 3px 4px;
    opacity: 1;
    pointer-events: auto;
  }

  .rail-flyout .rail-btn {
    width: 30px;
    height: 30px;
  }

  .rail-flyout .text-glyph {
    font-size: 11px;
  }

  .rail-flyout .icon {
    width: 18px;
    height: 18px;
  }

  .tooltip {
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    z-index: 10;
    padding: 3px 8px;
    border-radius: 3px;
    background: var(--color-bg-tooltip);
    color: var(--color-text);
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-50%);
    transition: opacity 0.1s ease;
  }

  .rail-btn:hover .tooltip {
    opacity: 1;
    visibility: visible;
  }
`;
