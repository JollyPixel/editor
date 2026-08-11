// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/fallbacks.ts";

export const folderStyles = css`
  :host {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);
    min-width: 0;
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
  }

  /*
   * A folder sits inside a plane, so it paints no surface of its own. The header
   * carries a control fill instead, which is what separates it from its rows.
   */
  .header {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    min-height: var(--jolly-row-height, 20px);
    padding-inline: var(--jolly-space-1, 4px);
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg, ${kFallback.controlBg});
    color: inherit;
    font: inherit;
    transition: background-color var(--jolly-duration-fast, 100ms)
      var(--jolly-easing, ease);
  }

  .header:hover,
  .header:focus-within {
    background: var(--jolly-control-bg-hover, ${kFallback.controlBg});
  }

  .toggle {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    align-self: stretch;
    gap: var(--jolly-space-1, 4px);
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .toggle .chevron {
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    color: var(--jolly-text-muted, ${kFallback.text});
    transform-origin: center;
    transition: transform var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  :host([open]) .toggle .chevron {
    transform: rotate(90deg);
  }

  .grip {
    display: none;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--jolly-text-muted, ${kFallback.text});
    cursor: grab;
  }

  .grip jolly-icon {
    width: 12px;
    height: 12px;
  }

  :host([reorderable]) .grip {
    display: inline-grid;
    place-items: center;
  }

  button:focus-visible {
    outline: none;
    background: var(--jolly-control-bg-focus);
  }

  .content {
    display: none;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);
    padding-inline-start: var(--jolly-space-1, 4px);
  }

  :host([open]) .content {
    display: flex;
  }
`;
