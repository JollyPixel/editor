// Import Third-party Dependencies
import { css } from "lit";

/**
 * Shared spacing, motion, and numeric-font tokens.
 */
export const scaleTokens = css`
  :host {
    --jolly-space-1: 4px;
    --jolly-space-2: 8px;
    --jolly-space-3: 12px;
    --jolly-space-4: 16px;
    --jolly-space-5: 20px;
    --jolly-space-6: 24px;

    /*
     * Two radii with clearly different jobs: controls are nearly square, planes
     * are visibly rounded, so the two never read as the same role.
     */
    --jolly-radius-sm: 2px;
    --jolly-radius-md: 6px;

    /*
     * Rows own no outer spacing. The container that stacks them applies this gap,
     * so consumers can stack fields flush when they want to.
     */
    --jolly-row-gap: var(--jolly-space-1);

    /* Extra separation after folder groups, including reordered folders. */
    --jolly-folder-gap: calc(var(--jolly-space-1) / 2);

    /*
     * Reserved leading space for the lock affordance. Zero by default; a
     * collaborative container opts its subtree in, which buys the fixed inset
     * that keeps lock state from shifting the row.
     */
    --jolly-gutter-width: 0px;

    /* Optional shared column for trailing revert and presence chrome. */
    --jolly-field-trailing-width: auto;

    --jolly-duration-fast: 100ms;
    --jolly-duration-base: 160ms;
    --jolly-easing: cubic-bezier(0.2, 0, 0.2, 1);

    --jolly-font-family: "Roboto Mono", ui-monospace, sfmono-regular, "Cascadia Code",
      consolas, monospace;
    --jolly-font-numeric: "tabular-nums";
  }

  @media (prefers-reduced-motion: reduce) {
    :host {
      --jolly-duration-fast: 0ms;
      --jolly-duration-base: 0ms;
    }
  }
`;
