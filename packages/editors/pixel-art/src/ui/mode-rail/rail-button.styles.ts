// Import Third-party Dependencies
import { css } from "lit";

export const railButtonStyles = css`
  .rail-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    gap: 4px;
  }

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
  }
  .rail-btn:hover:not(:disabled) {
    color: var(--color-text-emphasis);
  }
  .rail-btn.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-text-on-accent);
  }
  /*
   * :hover:not(:disabled) alone outranks .active by specificity, so without
   * this an active button's icon would flip to the dark hover color while
   * still sitting on the accent-blue background.
   */
  .rail-btn.active:hover:not(:disabled) {
    color: var(--color-text-on-accent);
  }
  .rail-btn:disabled {
    color: var(--color-border);
    cursor: default;
  }

  /* Small corner notch: hints a hover flyout is available without
     permanently spending rail space on a second button. */
  .rail-btn.has-flyout::after {
    content: "";
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 3px 0 3px 3.5px;
    border-color: transparent transparent transparent var(--color-text-muted);
    opacity: 0.8;
  }

  .rail-item.open .rail-btn.has-flyout::after,
  .rail-item:focus-within .rail-btn.has-flyout::after {
    opacity: 0;
  }

  .rail-item {
    position: relative;
    display: flex;
    flex-shrink: 0;
  }

  /*
   * Anchored to the button's right edge and merged into it visually (flush
   * radius, matching background): hovering reads as the rail itself
   * growing a horizontal extension rather than a floating popup opening.
   */
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
