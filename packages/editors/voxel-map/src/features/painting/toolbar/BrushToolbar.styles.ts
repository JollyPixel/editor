// Import Third-party Dependencies
import { css } from "lit";

export const brushToolbarStyles = css`
  :host {
    --voxel-toolbar-button-size: 30px;
    --voxel-axis-x: light-dark(
      var(--jolly-axis-x),
      oklch(from var(--jolly-axis-x) 72% c h)
    );
    --voxel-axis-y: light-dark(
      var(--jolly-axis-y),
      oklch(from var(--jolly-axis-y) 78% c h)
    );
    --voxel-axis-z: light-dark(
      var(--jolly-axis-z),
      oklch(from var(--jolly-axis-z) 76% calc(c * 1.6) h)
    );

    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .notice {
    --jolly-icon-size: 12px;
    --jolly-surface: var(--jolly-intent-warning-fill);

    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface);
    box-shadow: var(--jolly-shadow-floating);
    color: var(--jolly-text-on-fill);
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
  }

  .notice button {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .notice button:focus-visible {
    outline: 1px solid currentcolor;
    outline-offset: 1px;
  }

  jolly-rail {
    --jolly-icon-button-size: var(--voxel-toolbar-button-size);

    align-items: center;
    gap: 0;
    padding-inline: 4px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-floating);
  }

  .group {
    display: flex;
    align-items: center;
    gap: 0;
  }

  :host([disabled]) .brush {
    opacity: 0.6;
  }

  jolly-tool-button {
    --jolly-tool-button-size: var(--voxel-toolbar-button-size);
    --jolly-tool-button-gap: 10px;
  }

  jolly-tool-button::part(button) {
    border-radius: var(--jolly-radius-sm, 2px);
  }

  jolly-tool-button::part(notch) {
    display: none;
  }

  jolly-tool-button[slot="flyout"] {
    --jolly-tool-button-gap: 8px;
  }

  .separator {
    flex: 0 0 auto;
    width: 1px;
    height: 22px;
    margin-inline: 6px;
    background: var(--jolly-divider);
  }

  .size {
    min-width: 2ch;
    font-weight: 600;
    text-align: center;
  }

  .axis {
    display: inline-flex;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .axis .x {
    color: var(--voxel-axis-x);
  }

  .axis .y {
    color: var(--voxel-axis-y);
  }

  .axis .z {
    color: var(--voxel-axis-z);
  }
`;
