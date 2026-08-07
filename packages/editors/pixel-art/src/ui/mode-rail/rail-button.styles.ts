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
    color: var(--color-text-emphasis);
  }
  .rail-btn:disabled {
    color: var(--color-border);
    cursor: default;
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
