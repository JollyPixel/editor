// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/fallbacks.ts";

/**
 * Matches `JollyField` geometry for custom rows.
 */
export const propertyRowStyles = css`
  :host {
    display: block;
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
    color: var(--jolly-text, ${kFallback.text});
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    min-height: var(--jolly-row-height, 20px);
    /*
     * Match the field's leading inset and collapsible gutter.
     */
    padding-inline: calc(var(--jolly-gutter-width, 0px) + var(--jolly-space-1, 4px))
      var(--jolly-space-1, 4px);
  }

  /*
   * Use the shared label column when an ancestor sets it.
   */
  .label {
    flex: 0 0 auto;
    width: var(--jolly-label-width, auto);
    max-width: 45%;
    overflow: hidden;
    color: var(--jolly-text-muted);
    text-align: start;
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
  }

  /*
   * A row holds arbitrary content rather than an input, so the trailing edge is
   * reached by moving the content, not by setting text-align.
   */
  :host([align="end"]) .value {
    justify-content: flex-end;
  }

  /* A nested field already carries its own trailing row inset. */
  :host([align="end"]) ::slotted(jolly-checkbox[align="end"]) {
    margin-inline-end: calc(var(--jolly-space-1, 4px) * -1);
  }

  /* Let an opted-in checkbox carry its gradient across the whole value column. */
  :host([align="end"])
    ::slotted(jolly-checkbox[align="end"][clickable-background]) {
    flex: 1 1 auto;
    min-width: 0;
  }

  /*
   * Align descriptions with field help text.
   */
  .description {
    display: flex;
    align-items: flex-start;
    gap: var(--jolly-space-1, 4px);
    margin-block: calc(var(--jolly-space-1, 4px) / 2);
    margin-inline: calc(
        var(--jolly-gutter-width, 0px) + (var(--jolly-space-1, 4px) * 2)
      )
      var(--jolly-space-1, 4px);
    color: var(--jolly-text-muted);
    font-size: 0.9em;
  }

  .description jolly-icon {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    margin-block-start: 0;
    color: var(--jolly-accent-text);
  }
`;
