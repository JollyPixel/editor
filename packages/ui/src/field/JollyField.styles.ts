// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/fallbacks.ts";

/**
 * Shared field layout and state styles.
 */
export const fieldStyles = css`
  /* Keep locked-state padding stable. */
  :host {
    display: block;
    padding-block: var(--jolly-space-1, 4px);
    font-family: var(--jolly-font-family, system-ui, sans-serif);
    font-size: var(--jolly-font-size, 12px);
    color: var(--jolly-text, ${kFallback.text});
  }

  :host([disabled]) {
    opacity: 0.5;
    pointer-events: none;
  }

  /* Fixed insets prevent lock-state layout shifts. */
  .row {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    min-height: var(--jolly-row-height, 22px);
    padding-inline: var(--jolly-space-1, 4px);
  }

  .gutter {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
  }

  .revert {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    border-radius: var(--jolly-radius-sm, 3px);
    background: none;
    color: var(--jolly-modified);
    cursor: pointer;
    transition: background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .revert:hover {
    background: var(--jolly-control-bg-hover);
  }

  /* Avoid recoloring the nested revert icon. */
  .gutter > jolly-icon {
    color: var(--jolly-locked-ring, var(--jolly-locked));
  }

  /* Keep the lock tooltip clear of the leading lock bar. */
  .gutter[data-tooltip] {
    padding-inline-start: 3px;
  }

  /* A configured width aligns value columns across fields. */
  .label {
    flex: 0 0 auto;
    width: var(--jolly-label-width, auto);
    min-width: 0;
    max-width: 45%;
    overflow: hidden;
    color: var(--jolly-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
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

  /* Base input styles shared by field controls. */
  .value input:not([type="color"]),
  .value select {
    flex: 1 1 auto;
    min-width: 0;
    height: var(--jolly-control-height, 22px);
    padding: 0 var(--jolly-space-1, 4px);
    border: 1px solid var(--jolly-border-strong, ${kFallback.borderStrong});
    border-radius: var(--jolly-radius-sm, 3px);
    background: var(--jolly-control-bg, ${kFallback.controlBg});
    color: inherit;
    font: inherit;
    font-variant-numeric: inherit;
  }

  .value input:hover:not(:disabled),
  .value select:hover:not(:disabled) {
    background: var(--jolly-control-bg-hover);
  }

  .value input:focus-visible,
  .value select:focus-visible,
  .revert:focus-visible {
    outline: 2px solid var(--jolly-focus-ring, ${kFallback.focusRing});
    outline-offset: 2px;
  }

  /* Suppress the ring only for pointer-focused inputs. */
  .value input[data-pointer-focus]:focus-visible {
    outline: none;
  }

  :host([invalid]) .value input,
  :host([invalid]) .value select {
    border-color: var(--jolly-danger-border);
  }

  :host([readonly]) .value input,
  :host([readonly]) .value select {
    background: var(--jolly-surface-sunken);
  }

  /* The host lock state works for controls with different shapes. */
  :host([locked]) {
    box-shadow: inset 3px 0 0 0 var(--jolly-locked-ring, var(--jolly-locked));
    border-radius: var(--jolly-radius-sm, 3px);
    background: color-mix(
      in oklab,
      var(--jolly-locked-ring, var(--jolly-locked)) 12%,
      transparent
    );
  }

  .peers {
    display: flex;
    flex: 0 0 auto;
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

  /* Tooltips grow inward to stay within the field bounds. */
  [data-tooltip] {
    position: relative;
  }

  [data-tooltip]::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + var(--jolly-space-1, 4px));
    z-index: 1;
    padding: 2px 6px;
    border: 1px solid var(--jolly-peer-color, var(--jolly-locked-ring, var(--jolly-locked)));
    border-radius: var(--jolly-radius-sm, 3px);
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

  .gutter[data-tooltip]::after {
    left: 0;
  }

  .chip::after {
    right: 0;
  }

  [data-tooltip]:hover::after {
    opacity: 1;
    transform: translateY(0);
  }

  /* Align help and error text with the value area. */
  .description,
  .error {
    display: flex;
    align-items: flex-start;
    gap: var(--jolly-space-1, 4px);
    margin-block: calc(var(--jolly-space-1, 4px) / 2) 0;
    margin-inline: calc(14px + (var(--jolly-space-1, 4px) * 2)) var(--jolly-space-1, 4px);
    font-size: 0.9em;
  }

  .description jolly-icon,
  .error jolly-icon {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    margin-block-start: 0.15em;
  }

  .description {
    color: var(--jolly-text-muted);
  }

  .error {
    color: var(--jolly-danger);
  }
`;
