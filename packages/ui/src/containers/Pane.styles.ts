// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/fallbacks.ts";

export const paneStyles = css`
  /*
   * A pane paints a plane only when it is not already inside one. A dock or a
   * floating window nulls this out through "slotted", so a docked pane adds no
   * second surface and, unlike before, no shadow: only detached things cast one.
   */
  :host {
    display: flex;
    box-sizing: border-box;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 0;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface, ${kFallback.controlBg});
    color: var(--jolly-text, ${kFallback.text});
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  .header {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    gap: var(--jolly-space-2, 8px);
    min-height: var(--jolly-row-height, 20px);
    padding: var(--jolly-space-1, 4px) var(--jolly-space-2, 8px);
    border: 0;
    background: var(--jolly-control-bg, ${kFallback.controlBg});
    user-select: none;
  }

  /*
   * One bundled weight, so the title separates through tint and tracking rather
   * than through a bolder face that would have to be synthesised.
   */
  .title {
    overflow: hidden;
    flex: 1 1 auto;
    font-weight: 400;
    letter-spacing: 0.05em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
  }

  .content {
    display: flex;
    overflow: auto;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);
    min-height: 0;
    padding: var(--jolly-space-1, 4px);
    scrollbar-color: var(--jolly-groove) transparent;
    scrollbar-width: thin;
  }

  .content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .content::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 4px;
    background: var(--jolly-groove);
    background-clip: padding-box;
  }

  .live-region {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`;
