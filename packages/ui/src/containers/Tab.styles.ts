// Import Third-party Dependencies
import { css } from "lit";

export const tabStyles = css`
  :host {
    display: none;
    box-sizing: border-box;
    height: 100%;
  }

  :host([active]) {
    display: block;
  }
`;
