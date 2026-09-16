// Import Third-party Dependencies
import { css } from "lit";

/**
 * The UA `[hidden]` rule loses to a component's `:host { display }`,
 * so any element toggled through `.hidden` needs this.
 */
export const hiddenStyles = css`
  :host([hidden]) {
    display: none !important;
  }
`;
