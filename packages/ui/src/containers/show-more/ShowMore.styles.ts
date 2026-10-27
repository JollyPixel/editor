// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../../theme/styles/fallbacks.ts";
import { fillTransition } from "../../theme/styles/mixins.ts";

export const showMoreStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);
    min-width: 0;
  }

  ::slotted([data-show-more-overflow]) {
    display: none !important;
  }

  .more {
    display: flex;
    justify-content: center;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    height: var(--jolly-control-height, 20px);
    padding-inline: var(--jolly-space-2, 8px);
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: transparent;
    color: var(--jolly-text-muted, ${kFallback.text});
    font: inherit;
    font-size: var(--jolly-font-size, 11px);
    cursor: pointer;

    ${fillTransition}
  }

  .toggle:hover {
    background: var(--jolly-control-bg-hover, ${kFallback.controlBg});
    color: var(--jolly-text, ${kFallback.text});
  }

  .toggle:focus-visible {
    outline: none;
    background: var(--jolly-control-bg-focus, ${kFallback.controlBg});
    color: var(--jolly-text, ${kFallback.text});
  }

  .chevron {
    width: 10px;
    height: 10px;
    transform: rotate(90deg);
    transition: transform var(--jolly-duration-fast, 100ms)
      var(--jolly-easing, ease);
  }

  :host([expanded]) .chevron {
    transform: rotate(-90deg);
  }
`;
