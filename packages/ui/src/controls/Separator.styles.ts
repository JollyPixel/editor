// Import Third-party Dependencies
import { css } from "lit";

export const separatorStyles = css`
  :host {
    display: block;
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  .rule {
    flex: 1 1 auto;
    height: 1px;
    background: var(--jolly-divider);
  }

  .labelled {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-2, 8px);
    min-height: var(--jolly-row-height, 20px);
  }

  .caption {
    flex: 0 0 auto;
    color: var(--jolly-text-muted);
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    user-select: none;
  }
`;
