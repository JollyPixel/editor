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

  .labelled,
  .unlabelled {
    align-items: center;
    min-height: var(--jolly-row-height, 20px);
    margin-block-start: calc(var(--jolly-space-1, 4px) / 2);
  }

  .labelled {
    display: grid;
    grid-template-columns:
      calc(var(--jolly-gutter-width, 0px) + var(--jolly-space-1, 4px))
      auto
      minmax(0, 1fr);
    gap: var(--jolly-space-1, 4px);
  }

  .unlabelled {
    display: flex;
  }

  .labelled .rule {
    background: var(--jolly-separator-rule);
  }

  .caption {
    flex: 0 0 auto;
    color: var(--jolly-separator-label);
    font-size: 1em;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    user-select: none;
  }
`;
