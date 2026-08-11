// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { rampTokens } from "./ramps.ts";

/**
 * Public semantic tokens built from the internal ramps.
 */
const semanticTokens = css`
  --jolly-surface: light-dark(var(--jolly-neutral-50), var(--jolly-neutral-900));
  --jolly-surface-sunken: light-dark(var(--jolly-neutral-100), var(--jolly-neutral-950));
  --jolly-surface-raised: light-dark(var(--jolly-neutral-0), var(--jolly-neutral-800));

  --jolly-control-bg: light-dark(var(--jolly-neutral-0), var(--jolly-neutral-800));
  --jolly-control-bg-hover: light-dark(var(--jolly-neutral-100), var(--jolly-neutral-700));
  --jolly-control-bg-active: light-dark(var(--jolly-neutral-200), var(--jolly-neutral-600));

  --jolly-border: light-dark(var(--jolly-neutral-300), var(--jolly-neutral-700));
  --jolly-border-strong: light-dark(var(--jolly-neutral-500), var(--jolly-neutral-500));

  --jolly-text: light-dark(var(--jolly-neutral-900), var(--jolly-neutral-50));
  --jolly-text-muted: light-dark(var(--jolly-neutral-600), var(--jolly-neutral-400));
  --jolly-text-on-fill: var(--jolly-neutral-0);

  --jolly-accent-fill: var(--jolly-accent-600);
  --jolly-accent-text: light-dark(var(--jolly-accent-700), var(--jolly-accent-300));

  --jolly-focus-ring: light-dark(var(--jolly-accent-600), var(--jolly-accent-400));
  --jolly-danger: light-dark(var(--jolly-danger-700), var(--jolly-danger-300));
  --jolly-danger-border: light-dark(var(--jolly-danger-500), var(--jolly-danger-300));
  --jolly-warning: light-dark(var(--jolly-warning-700), var(--jolly-warning-300));
  --jolly-success: light-dark(var(--jolly-success-700), var(--jolly-success-300));

  --jolly-modified: light-dark(var(--jolly-accent-600), var(--jolly-accent-400));
  --jolly-locked: light-dark(var(--jolly-accent-600), var(--jolly-accent-400));

  --jolly-shadow-overlay: 0 2px 8px light-dark(rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.44));
  --jolly-shadow-floating: 0 4px 16px light-dark(rgb(0 0 0 / 0.18), rgb(0 0 0 / 0.5));
  --jolly-shadow-modal: 0 12px 40px light-dark(rgb(0 0 0 / 0.24), rgb(0 0 0 / 0.6));
`;

/**
 * Scope-host theme tokens with light and dark variants.
 */
export const themeTokens = css`
  :host {
    color-scheme: light dark;
    ${rampTokens}
    ${semanticTokens}
  }

  :host([theme="light"]) {
    color-scheme: light;
  }

  :host([theme="dark"]) {
    color-scheme: dark;
  }
`;
