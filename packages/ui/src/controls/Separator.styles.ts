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

  .row {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
  }

  .labelled,
  .unlabelled {
    flex: 1 1 auto;
    align-items: center;
    min-width: 0;
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

  ::slotted([slot="actions"]) {
    flex: 0 0 auto;
    margin-block-start: calc(var(--jolly-space-1, 4px) / 2);
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
