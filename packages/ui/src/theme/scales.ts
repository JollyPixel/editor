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

    --jolly-radius-sm: 3px;
    --jolly-radius-md: 5px;

    --jolly-duration-fast: 100ms;
    --jolly-duration-base: 160ms;
    --jolly-easing: cubic-bezier(0.2, 0, 0.2, 1);

    --jolly-font-family: system-ui, -apple-system, "Segoe UI", roboto, sans-serif;
    --jolly-font-numeric: "tabular-nums";
  }

  @media (prefers-reduced-motion: reduce) {
    :host {
      --jolly-duration-fast: 0ms;
      --jolly-duration-base: 0ms;
    }
  }
`;
