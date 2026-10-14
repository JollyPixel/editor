// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";
import {
  fillTransition,
  truncate,
  visuallyHidden
} from "../theme/styles/mixins.ts";

export const toggleStyles = css`
  :host {
    min-width: 0;
  }

  .toggle {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    gap: var(--jolly-space-2, 8px);
    min-width: 0;
    height: var(--jolly-control-height, 20px);
    padding-inline: var(--jolly-space-2, 8px) var(--jolly-space-1, 4px);
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg, ${kFallback.controlBg});
    cursor: pointer;
    user-select: none;

    ${fillTransition}
  }

  :host(:not([disabled], [readonly], [locked])) .toggle:hover {
    background: var(--jolly-control-bg-hover);
  }

  .toggle:has(input:focus-visible) {
    background: var(--jolly-control-bg-focus);
  }

  :host([invalid]) .toggle {
    background: var(--jolly-invalid-bg);
  }

  :host([invalid]:not([disabled], [readonly], [locked])) .toggle:hover {
    background: var(--jolly-invalid-bg-hover);
  }

  :host([invalid]) .toggle:has(input:focus-visible) {
    background: var(--jolly-invalid-bg-focus);
  }

  :host([readonly]) .toggle {
    background: var(--jolly-control-bg-muted);
  }

  :host([disabled]) .toggle,
  :host([readonly]) .toggle,
  :host([locked]) .toggle {
    cursor: default;
  }

  .text {
    flex: 1 1 auto;
    min-width: 0;
    text-align: start;

    ${truncate}
  }

  .value input[type="checkbox"] {
    ${visuallyHidden}
    margin: 0;
    padding: 0;
  }

  .switch {
    --jolly-toggle-knob: 8px;
    --jolly-toggle-inset: 2px;

    position: relative;
    flex: 0 0 auto;
    width: 22px;
    height: 12px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg-active);

    ${fillTransition}
  }

  .switch::before {
    content: "";
    position: absolute;
    inset-block: var(--jolly-toggle-inset);
    inset-inline-start: var(--jolly-toggle-inset);
    width: var(--jolly-toggle-knob);
    border-radius: 1px;
    background: var(--jolly-text-muted);
    transition:
      inset-inline-start var(--jolly-duration-base, 160ms)
        var(--jolly-easing, ease),
      background-color var(--jolly-duration-fast, 100ms)
        var(--jolly-easing, ease);
  }

  input:checked + .switch {
    background: var(--jolly-field-active-color);
  }

  input:checked + .switch::before {
    inset-inline-start: calc(
      100% - var(--jolly-toggle-knob) - var(--jolly-toggle-inset)
    );
    background: var(--jolly-surface-raised);
  }

  :host(:not([disabled], [readonly], [locked]))
    .toggle:hover input:checked + .switch {
    background: var(--jolly-field-active-color-hover);
  }

  input:indeterminate + .switch::before {
    inset-inline-start: calc(50% - var(--jolly-toggle-knob) / 2);
    background: var(--jolly-field-active-color);
  }
`;
