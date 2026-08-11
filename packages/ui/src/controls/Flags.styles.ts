// Import Third-party Dependencies
import { css } from "lit";

export const flagsStyles = css`
  .flags {
    display: flex;
    flex-wrap: wrap;
    flex: 1 1 auto;
    gap: var(--jolly-space-1, 4px);
    min-width: 0;
    padding: 2px 0;
  }

  /*
   * Each flag is its own filled pill, which gives the checkbox inside it
   * somewhere to show hover and focus.
   */
  .flag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: var(--jolly-control-height, 20px);
    padding-inline: var(--jolly-space-1, 4px);
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg);
    cursor: pointer;
    user-select: none;
    transition: background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .flag:hover {
    background: var(--jolly-control-bg-hover);
  }

  .flag:has(input:focus-visible) {
    background: var(--jolly-control-bg-focus);
  }

  :host([invalid]) .flag {
    background: var(--jolly-invalid-bg);
  }

  :host([readonly]) .flag {
    background: var(--jolly-control-bg-muted);
  }

  .value input[type="checkbox"] {
    flex: 0 0 auto;
    width: 13px;
    height: 13px;
    margin: 0;
    accent-color: var(--jolly-field-active-color);
    cursor: inherit;
  }

  .value input[type="checkbox"]:focus-visible {
    outline: none;
  }

  :host([disabled]) .flag {
    cursor: default;
  }
`;
