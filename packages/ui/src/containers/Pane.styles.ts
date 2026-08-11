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
    position: relative;
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    gap: var(--jolly-space-2, 8px);
    min-height: var(--jolly-row-height, 20px);
    overflow: hidden;
    padding: var(--jolly-space-1, 4px) var(--jolly-space-2, 8px);
    border: 0;
    background: var(
      --jolly-pane-header-bg,
      ${kFallback.paneHeaderBg}
    );
    color: var(--jolly-text-on-fill, white);
    user-select: none;
  }

  /* A larger left-origin checker distinguishes pane chrome from folders. */
  .header::before {
    position: absolute;
    z-index: 0;
    inset-block: 0;
    inset-inline-start: 0;
    width: 52%;
    background: conic-gradient(
        from 90deg,
        transparent 25%,
        currentColor 0 50%,
        transparent 0 75%,
        currentColor 0
      )
      0 / 12px 12px;
    color: var(--jolly-text-on-fill, white);
    content: "";
    opacity: 0.07;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(to right, black, transparent);
    mask-image: linear-gradient(to right, black, transparent);
  }

  /* Weight and tracking keep the title legible over the pixel pattern. */
  .title {
    position: relative;
    z-index: 1;
    overflow: hidden;
    flex: 1 1 auto;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    position: relative;
    z-index: 1;
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

  @media (forced-colors: active) {
    .header::before {
      display: none;
    }
  }
`;
