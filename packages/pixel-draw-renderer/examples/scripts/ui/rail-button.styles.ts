// Import Third-party Dependencies
import { css } from "lit";

// Shared by ModeRail (mode buttons) and PixelDrawPanel (undo/redo buttons) —
// both render `.rail-btn` entries inside a `.rail-section` group, in
// separate shadow roots.
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
    color: #ccc;
    cursor: pointer;
  }
  .rail-btn:hover:not(:disabled) {
    color: #fff;
  }
  .rail-btn.active {
    background: #4488ff;
    border-color: #4488ff;
    color: #fff;
  }
  .rail-btn:disabled {
    color: #556067;
    cursor: default;
  }

  .tooltip {
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    z-index: 10;
    padding: 3px 8px;
    border-radius: 3px;
    background: #1d262b;
    color: #eee;
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
