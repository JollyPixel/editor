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
    padding-block: var(--jolly-space-1, 4px);
    font-family: var(--jolly-font-family, system-ui, sans-serif);
    font-size: var(--jolly-font-size, 12px);
    color: var(--jolly-text, ${kFallback.text});
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    min-height: var(--jolly-row-height, 22px);
  /*
   * Match the field's leading inset and gutter.
   */
    padding-inline: calc(14px + (var(--jolly-space-1, 4px) * 2)) var(--jolly-space-1, 4px);
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
   * Align descriptions with field help text.
   */
  .description {
    display: flex;
    align-items: flex-start;
    gap: var(--jolly-space-1, 4px);
    margin-block: calc(var(--jolly-space-1, 4px) / 2) 0;
    margin-inline: calc(14px + (var(--jolly-space-1, 4px) * 2)) var(--jolly-space-1, 4px);
    color: var(--jolly-text-muted);
    font-size: 0.9em;
  }

  .description jolly-icon {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    margin-block-start: 0.15em;
  }
`;
