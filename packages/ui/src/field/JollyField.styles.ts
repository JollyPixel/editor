// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";
import { fillTransition, truncate } from "../theme/styles/mixins.ts";

/**
 * Shared field layout and state styles.
 */
export const fieldStyles = css`
  /*
   * Rows carry no outer spacing. The container that stacks them owns the gap,
   * so a consumer can stack fields flush when that is what they want.
   */
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
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    min-height: var(--jolly-row-height, 20px);
    padding-inline: var(--jolly-space-1, 4px);
    border-radius: var(--jolly-radius-sm, 2px);
    ${fillTransition}
  }

  /*
   * Flattened into the row's flex items by default, so inline layout is
   * unaffected by the grouping these wrap for stacked layout.
   */
  .leading,
  .content {
    display: contents;
  }

  :host([label-position="top"]) .row {
    flex-direction: column;
    align-items: stretch;
    min-height: auto;
    gap: calc(var(--jolly-space-1, 4px) / 2);
  }

  :host([label-position="top"]) .leading,
  :host([label-position="top"]) .content {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
  }

  /*
   * The gutter sits only on the label's line, so the value line needs a
   * matching inset to keep both lines starting at the same edge.
   */
  :host([label-position="top"]) .content {
    padding-inline-start: calc(
      var(--jolly-gutter-width, 0px) + var(--jolly-space-1, 4px)
    );
  }

  /* With no label the leading line is an empty band, unless it holds a lock. */
  :host([unlabeled]:not([locked])[label-position="top"]) .leading {
    display: none;
  }

  :host([unlabeled]:not([locked])[label-position="top"]) .content {
    padding-inline-start: 0;
  }

  /*
   * Locating the active row in a long pane. Deliberately fainter than the
   * control's own focus tint, so the two read as a hierarchy and not a clash.
   */
  .row:focus-within {
    background: var(--jolly-row-bg-focus);
  }

  /*
   * Zero width by default. A collaborative container opts its subtree in, which
   * buys back the fixed inset that keeps lock state from shifting the row.
   */
  .gutter {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    flex: 0 0 auto;
    width: var(--jolly-gutter-width, 0px);
    height: 14px;
    overflow: hidden;
  }

  /*
   * Without a label the gap after a collapsed gutter is an inset paid for
   * nothing. Locked keeps it: there the gutter paints an icon.
   */
  :host([unlabeled]:not([locked])) .gutter {
    margin-inline-end: calc(var(--jolly-space-1, 4px) * -1);
  }

  /*
   * A lock always has to be visible, even where nothing reserved room for it.
   * Opting the subtree in is what turns this from a widening row into a fixed
   * inset; without it the lock still shows, it just costs a shift.
   */
  :host([locked]) .gutter {
    width: max(var(--jolly-gutter-width, 0px), 14px);
    overflow: visible;
  }

  /*
   * Icons default to the 16px display size, which overflows the gutter. The
   * lock is chrome inside a 14px box, so it is sized to the box it sits in.
   */
  .gutter > jolly-icon {
    width: 14px;
    height: 14px;
    color: var(--jolly-locked-ring, var(--jolly-locked));
  }

  /* A configured width aligns value columns across fields. */
  .label {
    flex: 0 0 auto;
    width: var(--jolly-label-width, auto);
    min-width: 0;
    max-width: 45%;
    color: var(--jolly-text-muted);
    text-align: start;
    ${truncate}
    user-select: none;
  }

  :host([label-position="top"]) .label {
    width: auto;
    max-width: none;
  }

  .value {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    gap: var(--jolly-space-1, 4px);
    min-width: 0;
    font-variant-numeric: var(--jolly-font-numeric, tabular-nums);
  }

  /*
   * Base input styles shared by field controls. Boundaries are carried by the
   * fill, so there is no border to state here.
   */
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

  /*
   * Focus is a fill step rather than an outline. The step has to beat hover,
   * because both are the same channel.
   */
  .value input:focus,
  .value select:focus {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  /*
   * Numeric and monitor-style rows read better against the trailing edge, where
   * the digits line up down the pane.
   */
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

  /*
   * Modified and locked both want the leading bar, so locked takes it: a locked
   * field is not editable, which makes reverting moot anyway.
   */
  :host([modified]:not([locked])) {
    box-shadow: inset 2px 0 0 0 var(--jolly-field-active-color);
    border-radius: var(--jolly-radius-sm, 2px);
  }

  :host([locked]) {
    padding-block: calc(var(--jolly-space-1, 4px) / 2);
    box-shadow: inset 3px 0 0 0 var(--jolly-locked-ring, var(--jolly-locked));
    border-radius: var(--jolly-radius-sm, 2px);
    background: color-mix(
      in oklab,
      var(--jolly-locked-ring, var(--jolly-locked)) 12%,
      transparent
    );
  }

  /*
   * A container can reserve one trailing column across sibling fields. The
   * negative margin absorbs the row gap; padding restores it for presence,
   * while the revert button cancels that padding to stay joined to the value.
   */
  .trailing {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    flex: 0 0 auto;
    gap: var(--jolly-space-1, 4px);
    width: var(--jolly-field-trailing-width, auto);
    margin-inline-start: calc(var(--jolly-space-1, 4px) * -1);
    padding-inline-start: var(--jolly-space-1, 4px);
  }

  .trailing:not(:has(.revert, .peers)) {
    padding-inline-start: 0;
  }

  /*
   * The muted action stays visible while a modified value can be restored.
   * It joins the value edge and uses the full control height, so its hover fill
   * reads as trailing field chrome instead of a highlight behind the glyph.
   */
  .revert {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
    margin-inline-start: calc(var(--jolly-space-1, 4px) * -1);
    padding: 0;
    border: 0;
    border-radius:
      0
      var(--jolly-radius-sm, 2px)
      var(--jolly-radius-sm, 2px)
      0;
    background: none;
    color: var(--jolly-text-muted);
    cursor: pointer;
    ${fillTransition}
  }

  .revert > jolly-icon {
    width: 14px;
    height: 14px;
  }

  /* Filled values and the trailing action form a single control silhouette. */
  .value:has(+ .trailing > .revert) input[type="text"]:last-child,
  .value:has(+ .trailing > .revert) select {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  .revert:hover {
    background: var(--jolly-control-bg);
  }

  .revert:focus-visible {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  .peers {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    margin-inline-start: auto;
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

  /*
   * Offset on the tooltip rather than as gutter padding, which would widen the
   * gutter on exactly the rows that must not change width.
   */
  .gutter[data-tooltip]::after {
    left: 3px;
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
    margin-block: calc(var(--jolly-space-1, 4px) / 2);
    margin-inline: calc(
        var(--jolly-gutter-width, 0px) + (var(--jolly-space-1, 4px) * 2)
      )
      var(--jolly-space-1, 4px);
    font-size: 0.9em;
  }

  /* No label column to clear, so they follow the value back to the row inset. */
  :host([unlabeled]:not([locked])) .description,
  :host([unlabeled]:not([locked])) .error {
    margin-inline-start: calc(
      var(--jolly-gutter-width, 0px) + var(--jolly-space-1, 4px)
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
