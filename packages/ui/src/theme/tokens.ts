// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { rampTokens } from "./ramps.ts";

/**
 * Planes are opaque and painted only by window level containers.
 * Leaves tint instead, so a control composites over whichever plane it lands on.
 */
const surfaceTokens = css`
  --jolly-surface: light-dark(var(--jolly-neutral-100), var(--jolly-neutral-900));
  --jolly-surface-sunken: light-dark(var(--jolly-neutral-200), var(--jolly-neutral-950));
  --jolly-surface-raised: light-dark(var(--jolly-neutral-0), var(--jolly-neutral-800));
`;

/**
 * The single interactive colour. Every control background is this ink at an
 * alpha stop, which is what keeps nested containers coherent without each
 * depth picking its own opaque ramp index.
 */
const inkTokens = css`
  --jolly-ink: light-dark(var(--jolly-neutral-900), var(--jolly-neutral-50));
  --jolly-ink-danger: var(--jolly-danger-500);

  --jolly-control-bg: color-mix(in oklab, var(--jolly-ink) 8%, transparent);
  --jolly-control-bg-hover: color-mix(in oklab, var(--jolly-ink) 12%, transparent);
  --jolly-control-bg-focus: color-mix(in oklab, var(--jolly-ink) 20%, transparent);
  --jolly-control-bg-active: color-mix(in oklab, var(--jolly-ink) 26%, transparent);

  /* Below the rest stop, so a readonly control reads as inert rather than idle. */
  --jolly-control-bg-muted: color-mix(in oklab, var(--jolly-ink) 4%, transparent);

  /* Faint enough to locate the active row without competing with the control. */
  --jolly-row-bg-focus: color-mix(in oklab, var(--jolly-ink) 5%, transparent);

  /* Error re-tints the same mechanism, and starts above the hover stop so it
     never reads as "the pointer is here". */
  --jolly-invalid-bg: color-mix(in oklab, var(--jolly-ink-danger) 15%, transparent);
  --jolly-invalid-bg-hover: color-mix(in oklab, var(--jolly-ink-danger) 20%, transparent);
  --jolly-invalid-bg-focus: color-mix(in oklab, var(--jolly-ink-danger) 28%, transparent);

  /* Slider and scrub tracks read as a recess rather than a filled control. */
  --jolly-groove: color-mix(in oklab, var(--jolly-ink) 20%, transparent);

  /* Dividers sit below the control fill, so they separate without ruling. */
  --jolly-divider: color-mix(in oklab, var(--jolly-ink) 10%, transparent);

  /*
   * A control already filled with the accent has no room left to tint, so its
   * hover and focus steps lighten the fill instead.
   */
  --jolly-accent-fill-hover: color-mix(in oklab, var(--jolly-accent-fill) 88%, white);
  --jolly-accent-fill-focus: color-mix(in oklab, var(--jolly-accent-fill) 76%, white);
`;

/**
 * Public semantic tokens built from the internal ramps.
 */
const semanticTokens = css`
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
    ${surfaceTokens}
    ${inkTokens}
    ${semanticTokens}
  }

  :host([theme="light"]) {
    color-scheme: light;
  }

  :host([theme="dark"]) {
    color-scheme: dark;
  }

  /*
   * The design carries control boundaries with fill rather than an outline, which
   * the forced-colors palette flattens away. Restoring a system border here keeps
   * the controls operable without affecting the default design.
   */
  @media (forced-colors: active) {
    :host {
      --jolly-control-bg: ButtonFace;
      --jolly-control-bg-hover: ButtonFace;
      --jolly-control-bg-focus: ButtonFace;
      --jolly-control-bg-active: ButtonFace;
      --jolly-row-bg-focus: transparent;
      --jolly-groove: ButtonBorder;
    }
  }
`;
