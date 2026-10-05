// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";
import { fillTransition, truncate } from "../theme/styles/mixins.ts";

/**
 * Shared field layout and state styles.
 */
export const fieldStyles = css`
  :host {
    --jolly-field-active-color: light-dark(
      var(--jolly-neutral-600),
      var(--jolly-neutral-50)
    );
    --jolly-field-active-color-hover: light-dark(
      var(--jolly-neutral-500),
      var(--jolly-neutral-200)
    );

    display: block;
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
    color: var(--jolly-text, ${kFallback.text});
  }

  :host([colored]) {
    --jolly-field-active-color: var(--jolly-accent-fill);
    --jolly-field-active-color-hover: var(--jolly-accent-fill-hover);
  }

  :host([disabled]) {
    opacity: 0.5;
    pointer-events: none;
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    min-height: var(--jolly-row-height, 20px);
    padding-inline: var(--jolly-field-inset-start, var(--jolly-space-1, 4px))
      var(--jolly-field-inset-end, var(--jolly-space-1, 4px));
    border-radius: var(--jolly-radius-sm, 2px);

    ${fillTransition}
  }

  .leading,
  .content {
    display: contents;
  }

  :host([stacked]) .row {
    flex-direction: column;
    align-items: stretch;
    min-height: auto;
    gap: calc(var(--jolly-space-1, 4px) / 2);
  }

  :host([stacked]) .leading,
  :host([stacked]) .content {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
  }

  :host([stacked]) .content {
    padding-inline-start: calc(
      var(--jolly-gutter-width, 0px) +
        var(--jolly-field-inset-start, var(--jolly-space-1, 4px))
    );
  }

  :host([unlabeled][stacked]) .leading:not(:has(.hint, .revert)) {
    display: none;
  }

  :host([unlabeled][stacked]) .content {
    padding-inline-start: 0;
  }

  .row:focus-within {
    background: var(--jolly-row-bg-focus);
  }

  .gutter {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    flex: 0 0 auto;
    width: var(--jolly-gutter-width, 0);
    height: 14px;
    overflow: hidden;
  }

  :host([unlabeled]) .gutter {
    margin-inline-end: calc(var(--jolly-space-1, 4px) * -1);
  }

  :host([unlabeled]) .row {
    padding-inline-start: var(--jolly-field-inset-end, var(--jolly-space-1, 4px));
  }

  .label-cell {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    gap: calc(var(--jolly-space-1, 4px) / 2);
    width: var(--jolly-label-width, auto);
    min-width: 0;
    max-width: var(--jolly-label-max-width, 45%);
  }

  :host([unlabeled]) .label-cell,
  :host([stacked]) .label-cell {
    width: auto;
    max-width: none;
  }

  :host([stacked]) .label-cell {
    flex-shrink: 1;
  }

  :host([unlabeled]) .label-cell:not(:has(.hint, .revert)) {
    display: none;
  }

  .label {
    flex: 0 1 auto;
    min-width: 0;
    color: var(--jolly-text-muted);
    text-align: start;

    ${truncate}
    user-select: none;
  }

  .value {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    gap: var(--jolly-space-1, 4px);
    min-width: 0;
    font-variant-numeric: var(--jolly-font-numeric, tabular-nums);
  }

  .value input:not([type="color"]),
  .value select {
    flex: 1 1 auto;
    min-width: 0;
    height: var(--jolly-control-height, 20px);
    padding: 0 var(--jolly-space-1, 4px);
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg, ${kFallback.controlBg});
    color: inherit;
    font: inherit;
    font-variant-numeric: inherit;

    ${fillTransition}
  }

  .value input:hover:not(:disabled),
  .value select:hover:not(:disabled) {
    background: var(--jolly-control-bg-hover);
  }

  .value input:focus,
  .value select:focus {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  :host([align="end"]) .value input,
  :host([align="end"]) .value select {
    text-align: end;
  }

  :host([invalid]) .value input,
  :host([invalid]) .value select {
    background: var(--jolly-invalid-bg);
  }

  :host([invalid]) .value input:hover:not(:disabled),
  :host([invalid]) .value select:hover:not(:disabled) {
    background: var(--jolly-invalid-bg-hover);
  }

  :host([invalid]) .value input:focus,
  :host([invalid]) .value select:focus {
    background: var(--jolly-invalid-bg-focus);
  }

  :host([readonly]) .value input,
  :host([readonly]) .value select {
    background: var(--jolly-control-bg-muted);
  }

  :host([modified]:not([locked])) {
    box-shadow: inset 2px 0 0 0 var(--jolly-field-active-color);
    border-radius: var(--jolly-radius-sm, 2px);
  }

  :host([locked]) {
    box-shadow: inset 3px 0 0 0 var(--jolly-locked-ring, var(--jolly-locked));
    border-radius: var(--jolly-radius-sm, 2px);
    background: color-mix(
      in oklab,
      var(--jolly-locked-ring, var(--jolly-locked)) 12%,
      transparent
    );
  }

  .revert {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
    margin-inline: auto calc(var(--jolly-space-1, 4px) * -1);
    padding: 0;
    border: 0;
    border-start-start-radius: var(--jolly-radius-sm, 2px);
    border-start-end-radius: 0;
    border-end-start-radius: var(--jolly-radius-sm, 2px);
    border-end-end-radius: 0;
    background: none;
    color: var(--jolly-text-muted);
    cursor: pointer;

    ${fillTransition}
  }

  .revert > jolly-icon {
    width: 14px;
    height: 14px;
  }

  :host([stacked]) .revert {
    width: 14px;
    height: 14px;
    margin-inline-end: 0;
    border-radius: var(--jolly-radius-sm, 2px);
  }

  :host(:not([stacked])) .row:has(.revert) .value > input[type="text"]:first-child,
  :host(:not([stacked])) .row:has(.revert) .value > .wrap:first-child > input,
  :host(:not([stacked])) .row:has(.revert) .value select {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }

  .revert:hover {
    background: var(--jolly-control-bg);
  }

  .revert:focus-visible {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  .peers {
    position: absolute;
    top: -4px;
    inset-inline-end: 2px;
    z-index: 1;
    display: flex;
    align-items: center;
  }

  .chip {
    width: 10px;
    height: 10px;
    margin-left: -3px;
    border: 1px solid var(--jolly-surface);
    border-radius: 50%;
  }

  .chip:first-child {
    margin-left: 0;
  }

  .overflow {
    margin-left: var(--jolly-space-1, 4px);
    color: var(--jolly-text-muted);
    font-size: 0.85em;
  }

  [data-tooltip] {
    position: relative;
  }

  [data-tooltip]::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + var(--jolly-space-1, 4px));
    z-index: 1;
    padding: 2px 6px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-overlay);
    color: var(--jolly-text);
    font-size: 0.85em;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translateY(2px);
    transition:
      opacity var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      transform var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .row[data-tooltip]::after {
    left: 0;
  }

  .chip::after {
    right: 0;
  }

  [data-tooltip]:hover::after {
    opacity: 1;
    transform: translateY(0);
  }

  .description,
  .error {
    display: flex;
    align-items: flex-start;
    gap: var(--jolly-space-1, 4px);
    margin-block: calc(var(--jolly-space-1, 4px) / 2);
    margin-inline: calc(
        var(--jolly-gutter-width, 0px) +
          (var(--jolly-field-inset-start, var(--jolly-space-1, 4px)) * 2)
      )
      var(--jolly-field-inset-end, var(--jolly-space-1, 4px));
    font-size: 0.9em;

    /* The reflected align attribute is a presentational hint on the host. */
    text-align: start;
  }

  :host([unlabeled]) .description,
  :host([unlabeled]) .error {
    margin-inline-start: calc(
      var(--jolly-gutter-width, 0px) +
        var(--jolly-field-inset-end, var(--jolly-space-1, 4px))
    );
  }

  .description jolly-icon,
  .error jolly-icon {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    margin-block-start: 0;
  }

  .description {
    color: var(--jolly-text-muted);
  }

  .description jolly-icon {
    color: var(--jolly-accent-text);
  }

  .error {
    color: var(--jolly-danger);
  }
`;
