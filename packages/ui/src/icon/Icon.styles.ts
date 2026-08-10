// Import Third-party Dependencies
import { css } from "lit";

export const iconStyles = css`
  :host {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: var(--jolly-icon-size, 16px);
    height: var(--jolly-icon-size, 16px);
    color: inherit;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
`;
