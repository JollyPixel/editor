// Import Third-party Dependencies
import { css } from "lit";

export const scaleTokens = css`
  :host {
    --jolly-space-1: 4px;
    --jolly-space-2: 8px;
    --jolly-space-3: 12px;
    --jolly-space-4: 16px;
    --jolly-space-5: 20px;
    --jolly-space-6: 24px;

    /* Controls are nearly square, planes visibly rounded. */
    --jolly-radius-sm: 2px;
    --jolly-radius-md: 6px;

    /* Rows own no outer spacing; the stacking container applies this gap. */
    --jolly-row-gap: var(--jolly-space-1);

    /* Extra separation after folder groups. */
    --jolly-folder-gap: calc(var(--jolly-space-1) / 2);

    /* Lock affordance space; collaborative containers opt their subtree in. */
    --jolly-gutter-width: 0px;

    /* Shared column for trailing revert and presence chrome. */
    --jolly-field-trailing-width: auto;

    /* Set to 0 beside folder headers, whose bar paints past the value. */
    --jolly-field-inset-end: var(--jolly-space-1);
    --jolly-duration-fast: 100ms;
    --jolly-duration-base: 160ms;
    --jolly-easing: cubic-bezier(0.2, 0, 0.2, 1);
    --jolly-duration-enter: 250ms;
    --jolly-duration-exit: 150ms;
    --jolly-easing-overlay: cubic-bezier(0.22, 1, 0.36, 1);
    --jolly-overlay-scale: 0.96;
    --jolly-font-family: "Roboto Mono", ui-monospace, sfmono-regular, "Cascadia Code",
      consolas, monospace;
    --jolly-font-numeric: "tabular-nums";
  }

  @media (prefers-reduced-motion: reduce) {
    :host {
      --jolly-duration-fast: 0ms;
      --jolly-duration-base: 0ms;
      --jolly-duration-enter: 0ms;
      --jolly-duration-exit: 0ms;
    }
  }
`;
