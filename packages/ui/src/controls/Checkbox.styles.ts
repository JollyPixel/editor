// Import Third-party Dependencies
import { css } from "lit";

/** Keeps checkboxes fixed-size and aligned to the requested logical edge. */
export const checkboxStyles = css`
  .value {
    justify-content: flex-start;
  }

  :host([align="end"]) .value,
  :host([align="end"]) .checkbox {
    justify-content: flex-end;
  }

  /* Keep the native control on the same hit target as the other fields. */
  .checkbox {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    flex: 0 0 auto;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
  }

  :host([clickable-background]) .checkbox {
    position: relative;
    isolation: isolate;
    flex: 1 1 auto;
    width: auto;
    cursor: pointer;
  }

  :host([clickable-background]) .checkbox::before {
    --jolly-checkbox-gradient-direction: to right;

    content: "";
    position: absolute;
    inset-block: calc(var(--jolly-space-1, 4px) / 2);
    inset-inline: 0;
    z-index: -1;
    border-start-start-radius: var(--jolly-radius-sm, 2px);
    border-end-start-radius: var(--jolly-radius-sm, 2px);
    background-image: linear-gradient(
      var(--jolly-checkbox-gradient-direction),
      var(--jolly-control-bg),
      transparent 72%
    );
  }

  :host([clickable-background][align="end"]) .checkbox::before,
  :host([clickable-background]:dir(rtl)) .checkbox::before {
    --jolly-checkbox-gradient-direction: to left;
  }

  :host([clickable-background][align="end"]:dir(rtl)) .checkbox::before {
    --jolly-checkbox-gradient-direction: to right;
  }

  :host([clickable-background][align="end"]) .checkbox::before {
    border-start-start-radius: 0;
    border-start-end-radius: var(--jolly-radius-sm, 2px);
    border-end-start-radius: 0;
    border-end-end-radius: var(--jolly-radius-sm, 2px);
  }

  :host(
    [clickable-background]:not([disabled]):not([readonly]):not([locked])
  ) .checkbox:hover::before {
    background-image: linear-gradient(
      var(--jolly-checkbox-gradient-direction),
      var(--jolly-control-bg-hover),
      transparent 72%
    );
  }

  :host(
    [clickable-background]:not([disabled]):not([readonly]):not([locked])
  ) .checkbox:has(input:focus-visible)::before {
    background-image: linear-gradient(
      var(--jolly-checkbox-gradient-direction),
      var(--jolly-control-bg-focus),
      transparent 72%
    );
  }

  .value input[type="checkbox"] {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--jolly-field-active-color);
    cursor: pointer;
  }

  :host([clickable-background]) .value input[type="checkbox"] {
    margin-inline: var(--jolly-space-1, 4px) 0;
  }

  :host([clickable-background][align="end"]) .value input[type="checkbox"] {
    margin-inline: 0 var(--jolly-space-1, 4px);
  }

  .value input[type="checkbox"]:focus-visible {
    outline: none;
  }

  :host([disabled]) .value input[type="checkbox"] {
    cursor: default;
  }

  :host([clickable-background][disabled]) .checkbox,
  :host([clickable-background][readonly]) .checkbox,
  :host([clickable-background][locked]) .checkbox {
    cursor: default;
  }
`;
