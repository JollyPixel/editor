// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { rampTokens } from "./ramps.ts";

/**
 * Opaque planes, painted only by window-level containers; leaves tint instead.
 */
const surfaceTokens = css`
  --jolly-surface: light-dark(var(--jolly-neutral-100), var(--jolly-neutral-900));
  --jolly-surface-sunken: light-dark(var(--jolly-neutral-200), var(--jolly-neutral-950));
  --jolly-surface-raised: light-dark(var(--jolly-neutral-0), var(--jolly-neutral-800));
`;

/**
 * Control backgrounds are the ink at alpha stops, so nesting stays coherent.
 */
const inkTokens = css`
  --jolly-ink: light-dark(var(--jolly-neutral-900), var(--jolly-neutral-50));
  --jolly-ink-danger: var(--jolly-danger-500);
  --jolly-control-bg: color-mix(in oklab, var(--jolly-ink) 8%, transparent);
  --jolly-control-bg-hover: color-mix(in oklab, var(--jolly-ink) 12%, transparent);
  --jolly-control-bg-focus: color-mix(in oklab, var(--jolly-ink) 20%, transparent);
  --jolly-control-bg-active: color-mix(in oklab, var(--jolly-ink) 26%, transparent);

  /* Blue chrome sets containers apart from neutral leaf controls. */
  --jolly-folder-header-bg: color-mix(
    in oklab,
    var(--jolly-accent-fill) 12%,
    transparent
  );
  --jolly-folder-header-bg-hover: color-mix(
    in oklab,
    var(--jolly-accent-fill) 18%,
    transparent
  );

  /* Inverted to stay legible over the header. */
  --jolly-folder-action-fg: var(--jolly-surface);
  --jolly-folder-action-bg: color-mix(
    in oklab,
    var(--jolly-ink) 84%,
    var(--jolly-surface)
  );
  --jolly-folder-action-bg-hover: color-mix(
    in oklab,
    var(--jolly-ink) 92%,
    var(--jolly-surface)
  );
  --jolly-folder-action-bg-focus: var(--jolly-ink);
  --jolly-folder-action-bg-active: var(--jolly-ink);

  /* Red ground in both themes, so the glyph stays white. */
  --jolly-folder-action-danger-fg: var(--jolly-neutral-0);
  --jolly-folder-action-danger-bg: var(--jolly-ink-danger);
  --jolly-folder-action-danger-bg-hover: color-mix(
    in oklab,
    var(--jolly-ink-danger) 86%,
    var(--jolly-ink)
  );
  --jolly-folder-action-danger-bg-focus: color-mix(
    in oklab,
    var(--jolly-ink-danger) 72%,
    var(--jolly-ink)
  );

  /* Tab hover stays below the control stop; selection uses the accent tint. */
  --jolly-tab-bg-hover: color-mix(in oklab, var(--jolly-ink) 6%, transparent);
  --jolly-tab-selected-bg: color-mix(
    in oklab,
    var(--jolly-accent-fill) 14%,
    transparent
  );
  --jolly-tab-selected-bg-hover: color-mix(
    in oklab,
    var(--jolly-accent-fill) 20%,
    transparent
  );
  --jolly-tab-close-bg-hover: color-mix(
    in oklab,
    var(--jolly-ink-danger) 22%,
    transparent
  );
  --jolly-tab-close-fg-hover: var(--jolly-ink-danger);
  --jolly-tab-badge-bg: color-mix(
    in oklab,
    var(--jolly-warning-500) 24%,
    transparent
  );
  --jolly-tab-badge-fg: var(--jolly-warning);
  --jolly-pane-header-bg: var(--jolly-accent-fill);
  --jolly-dialog-header-bg: var(--jolly-accent-fill);
  --jolly-dock-resize-bg: color-mix(
    in oklab,
    var(--jolly-accent-fill) 12%,
    transparent
  );
  --jolly-dock-resize-bg-hover: color-mix(
    in oklab,
    var(--jolly-accent-fill) 18%,
    transparent
  );

  /* Below the resize wash: a dock-sized tint would read as a filled panel. */
  --jolly-dock-zone-bg: color-mix(
    in oklab,
    var(--jolly-accent-fill) 6%,
    transparent
  );
  --jolly-dock-zone-bg-armed: color-mix(
    in oklab,
    var(--jolly-accent-fill) 10%,
    transparent
  );

  /* Below the rest stop, so readonly reads as inert. */
  --jolly-control-bg-muted: color-mix(in oklab, var(--jolly-ink) 4%, transparent);
  --jolly-row-bg-focus: color-mix(in oklab, var(--jolly-ink) 5%, transparent);

  /* Starts above the hover stop so an error never reads as hover. */
  --jolly-invalid-bg: color-mix(in oklab, var(--jolly-ink-danger) 15%, transparent);
  --jolly-invalid-bg-hover: color-mix(in oklab, var(--jolly-ink-danger) 20%, transparent);
  --jolly-invalid-bg-focus: color-mix(in oklab, var(--jolly-ink-danger) 28%, transparent);
  --jolly-groove: color-mix(in oklab, var(--jolly-ink) 20%, transparent);
  --jolly-divider: color-mix(in oklab, var(--jolly-ink) 10%, transparent);

  /* Accent-filled controls lighten on hover and focus instead of tinting. */
  --jolly-accent-fill-hover: color-mix(in oklab, var(--jolly-accent-fill) 88%, white);
  --jolly-accent-fill-focus: color-mix(in oklab, var(--jolly-accent-fill) 76%, white);
`;

const semanticTokens = css`
  --jolly-border: light-dark(var(--jolly-neutral-300), var(--jolly-neutral-700));
  --jolly-border-strong: light-dark(var(--jolly-neutral-500), var(--jolly-neutral-500));
  --jolly-text: light-dark(var(--jolly-neutral-900), var(--jolly-neutral-50));
  --jolly-text-muted: light-dark(var(--jolly-neutral-600), var(--jolly-neutral-400));
  --jolly-text-on-fill: var(--jolly-neutral-0);
  --jolly-accent-fill: var(--jolly-area-fill, var(--jolly-accent-600));
  --jolly-accent-text: var(
    --jolly-area-tone,
    light-dark(var(--jolly-accent-700), var(--jolly-accent-300))
  );
  --jolly-separator-label: var(--jolly-accent-text);
  --jolly-separator-rule: color-mix(
    in oklab,
    var(--jolly-accent-text) 28%,
    transparent
  );
  --jolly-focus-ring: var(
    --jolly-area-tone,
    light-dark(var(--jolly-accent-600), var(--jolly-accent-400))
  );
  --jolly-danger: light-dark(var(--jolly-danger-700), var(--jolly-danger-300));
  --jolly-danger-border: light-dark(var(--jolly-danger-500), var(--jolly-danger-300));
  --jolly-warning: light-dark(var(--jolly-warning-700), var(--jolly-warning-300));
  --jolly-success: light-dark(var(--jolly-success-700), var(--jolly-success-300));
  --jolly-intent-info-fill: var(--jolly-accent-600);
  --jolly-intent-success-fill: var(--jolly-success-700);
  --jolly-intent-warning-fill: var(--jolly-warning-700);
  --jolly-intent-danger-fill: var(--jolly-danger-700);
  --jolly-modified: light-dark(var(--jolly-accent-600), var(--jolly-accent-400));
  --jolly-locked: light-dark(var(--jolly-accent-600), var(--jolly-accent-400));
  --jolly-shadow-overlay: 0 2px 8px light-dark(rgb(0 0 0 / 16%), rgb(0 0 0 / 44%));
  --jolly-shadow-floating: 0 4px 16px light-dark(rgb(0 0 0 / 18%), rgb(0 0 0 / 50%));
  --jolly-shadow-modal: 0 12px 40px light-dark(rgb(0 0 0 / 24%), rgb(0 0 0 / 60%));
`;

const toneTokens = css`
  --jolly-tone-coral: light-dark(var(--jolly-coral-600), var(--jolly-coral-400));
  --jolly-tone-amber: light-dark(var(--jolly-amber-600), var(--jolly-amber-400));
  --jolly-tone-lime: light-dark(var(--jolly-lime-600), var(--jolly-lime-400));
  --jolly-tone-teal: light-dark(var(--jolly-teal-600), var(--jolly-teal-400));
  --jolly-tone-sky: light-dark(var(--jolly-sky-600), var(--jolly-sky-400));
  --jolly-tone-violet: light-dark(var(--jolly-violet-600), var(--jolly-violet-400));
  --jolly-tone-pink: light-dark(var(--jolly-pink-600), var(--jolly-pink-400));
  --jolly-tone-coral-on-fill: var(--jolly-coral-300);
  --jolly-tone-amber-on-fill: var(--jolly-amber-300);
  --jolly-tone-lime-on-fill: var(--jolly-lime-300);
  --jolly-tone-teal-on-fill: var(--jolly-teal-300);
  --jolly-tone-sky-on-fill: var(--jolly-sky-300);
  --jolly-tone-violet-on-fill: var(--jolly-violet-300);
  --jolly-tone-pink-on-fill: var(--jolly-pink-300);
  --jolly-tone-coral-fill: var(--jolly-coral-600);
  --jolly-tone-amber-fill: var(--jolly-amber-600);
  --jolly-tone-lime-fill: var(--jolly-lime-600);
  --jolly-tone-teal-fill: var(--jolly-teal-600);
  --jolly-tone-sky-fill: var(--jolly-sky-600);
  --jolly-tone-violet-fill: var(--jolly-violet-600);
  --jolly-tone-pink-fill: var(--jolly-pink-600);
  --jolly-icon-tone-rest: 55%;
  --jolly-icon-tone-engaged: 100%;
`;

export const themeTokens = css`
  :host {
    color-scheme: light dark;

    ${rampTokens}

    ${surfaceTokens}

    ${inkTokens}

    ${semanticTokens}

    ${toneTokens}
  }

  :host([theme="light"]) {
    color-scheme: light;
  }

  :host([theme="dark"]) {
    color-scheme: dark;
  }

  /* Forced colors flatten fill-based control boundaries; use system colors. */
  @media (forced-colors: active) {
    :host {
      --jolly-control-bg: ButtonFace;
      --jolly-control-bg-hover: ButtonFace;
      --jolly-control-bg-focus: ButtonFace;
      --jolly-control-bg-active: ButtonFace;
      --jolly-folder-header-bg: ButtonFace;
      --jolly-folder-header-bg-hover: ButtonFace;
      --jolly-folder-action-fg: ButtonText;
      --jolly-folder-action-bg: ButtonFace;
      --jolly-folder-action-bg-hover: ButtonFace;
      --jolly-folder-action-bg-focus: ButtonFace;
      --jolly-folder-action-bg-active: ButtonFace;
      --jolly-folder-action-danger-fg: ButtonText;
      --jolly-folder-action-danger-bg: ButtonFace;
      --jolly-folder-action-danger-bg-hover: ButtonFace;
      --jolly-folder-action-danger-bg-focus: ButtonFace;
      --jolly-tab-bg-hover: ButtonFace;
      --jolly-tab-selected-bg: ButtonFace;
      --jolly-tab-selected-bg-hover: ButtonFace;
      --jolly-tab-close-bg-hover: ButtonFace;
      --jolly-tab-close-fg-hover: ButtonText;
      --jolly-tab-badge-bg: ButtonFace;
      --jolly-tab-badge-fg: ButtonText;
      --jolly-pane-header-bg: ButtonFace;
      --jolly-dialog-header-bg: ButtonFace;
      --jolly-dock-resize-bg: ButtonFace;
      --jolly-dock-resize-bg-hover: Highlight;
      --jolly-separator-label: CanvasText;
      --jolly-separator-rule: ButtonBorder;
      --jolly-row-bg-focus: transparent;
      --jolly-groove: ButtonBorder;
    }
  }
`;
