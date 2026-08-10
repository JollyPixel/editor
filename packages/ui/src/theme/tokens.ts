// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { rampTokens } from "./ramps.ts";

/**
 * Tier 2, the only names components read and consumers override. One `light-dark()` pair per
 * token over two ramp steps, so the themes cannot disagree on which surface is darker.
 *
 * Ratios were verified when the steps were chosen (see docs/theming.md). `--jolly-border` is
 * deliberately under 3:1: it divides surfaces, which WCAG 1.4.11 does not cover. Control outlines
 * use `--jolly-border-strong`.
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
 * Goes on a scope host, never a leaf. The `theme` attribute only flips `color-scheme`, so two
 * panes on one page can carry different themes.
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
