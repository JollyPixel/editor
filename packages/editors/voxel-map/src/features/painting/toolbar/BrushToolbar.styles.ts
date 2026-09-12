// Import Third-party Dependencies
import { css } from "lit";

export const brushToolbarStyles = css`
  :host {
    display: inline-flex;
  }

  jolly-rail {
    --jolly-icon-button-size: 36px;

    align-items: center;
    gap: 2px;
    padding-inline: 6px;
    border-radius: 999px;
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-floating);
  }

  :host([disabled]) jolly-rail {
    opacity: 0.6;
  }

  jolly-tool-button {
    --jolly-tool-button-gap: 12px;
  }

  jolly-tool-button::part(button) {
    border-radius: 999px;
  }

  jolly-tool-button[slot="flyout"] {
    --jolly-tool-button-gap: 8px;
  }

  .divider {
    flex: 0 0 auto;
    width: 1px;
    height: 20px;
    margin-inline: 2px;
    background: var(--jolly-divider);
  }

  .size {
    min-width: 2ch;
    font-weight: 600;
    text-align: center;
  }
`;
