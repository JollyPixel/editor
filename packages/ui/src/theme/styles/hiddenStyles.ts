// Import Third-party Dependencies
import { css } from "lit";

/**
 * The UA stylesheet's `[hidden] { display: none }` carries no `!important`,
 * so it loses to a component's own unconditional `:host { display: ... }`
 * rule: author styles beat UA styles at equal specificity. Every element
 * that sets `.hidden` (the facade does, on Binding/Monitor/Button/Separator
 * and their containers) needs this to actually disappear.
 */
export const hiddenStyles = css`
  :host([hidden]) {
    display: none !important;
  }
`;
