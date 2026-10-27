// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import {
  iconButton,
  truncate
} from "../theme/styles/mixins.ts";

export const referenceStyles = css`
  .value .reference {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
  }

  .value .trigger {
    display: flex;
    align-items: center;
    padding-inline-end: 22px;
    cursor: default;
  }

  .value .reference:has(.clear) .trigger {
    padding-inline-end: 40px;
  }

  .value .trigger-label {
    flex: 1 1 auto;
    min-width: 0;

    ${truncate}
  }

  .value .trigger-label[data-empty] {
    color: var(--jolly-text-muted);
  }

  .actions {
    position: absolute;
    top: 50%;
    right: 2px;
    display: flex;
    gap: 2px;
    transform: translateY(-50%);
  }

  .clear,
  .browse {
    width: 16px;
    height: 16px;
    color: var(--jolly-text-muted);

    ${iconButton}
  }

  .clear jolly-icon,
  .browse jolly-icon {
    --jolly-icon-size: 12px;
  }

  .clear:hover,
  .browse:hover:not(:disabled) {
    background: var(--jolly-control-bg-hover);
    color: var(--jolly-text);
  }

  .browse:disabled {
    cursor: default;
    opacity: 0.6;
  }
`;
