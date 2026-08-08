// Import Third-party Dependencies
import { css } from "lit";

export type ThemeMode = "light" | "dark" | "auto";

/**
 * Light/dark token sets tuned for WCAG AA in their real usage pairs.
 * Accent color differs per theme to keep white-on-accent contrast valid.
 * `--color-canvas-bg` is visual-only (no text), and `--color-swatch-edge`
 * is transparent in light mode but explicit in dark mode for separation.
 *
 * Resolution order:
 * - `:host` default = light
 * - `prefers-color-scheme: dark` applies for `theme="auto"`
 * - `[theme="light"]` / `[theme="dark"]` overrides media preference
 */
export const themeStyles = css`
  :host {
    --color-bg-surface: #eef3f8;
    --color-bg-overlay: rgba(255, 255, 255, 0.92);
    --color-bg-tooltip: #dbe7f2;
    --color-bg-control: #20344c;
    --color-border: #6f8caa;
    --color-divider: #c5d7e6;
    --color-text: #16232f;
    --color-text-muted: #465a6e;
    --color-text-emphasis: #0b1420;
    --color-text-on-accent: #ffffff;
    --color-accent: #2f6fd8;
    --color-canvas-bg: #d7e3ee;
    --color-swatch-edge: transparent;
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --color-bg-surface: #131b24;
      --color-bg-overlay: rgba(24, 34, 48, 0.92);
      --color-bg-tooltip: #0d1520;
      --color-bg-control: #2a3b52;
      --color-border: #56708a;
      --color-divider: #22303c;
      --color-text: #e8eef5;
      --color-text-muted: #90a4b7;
      --color-text-emphasis: #ffffff;
      --color-text-on-accent: #ffffff;
      --color-accent: #3a6fc2;
      --color-canvas-bg: #0d151d;
      --color-swatch-edge: rgba(255, 255, 255, 0.22);
    }
  }

  :host([theme="light"]) {
    --color-bg-surface: #eef3f8;
    --color-bg-overlay: rgba(255, 255, 255, 0.92);
    --color-bg-tooltip: #dbe7f2;
    --color-bg-control: #20344c;
    --color-border: #6f8caa;
    --color-divider: #c5d7e6;
    --color-text: #16232f;
    --color-text-muted: #465a6e;
    --color-text-emphasis: #0b1420;
    --color-text-on-accent: #ffffff;
    --color-accent: #2f6fd8;
    --color-canvas-bg: #d7e3ee;
    --color-swatch-edge: transparent;
  }

  :host([theme="dark"]) {
    --color-bg-surface: #131b24;
    --color-bg-overlay: rgba(24, 34, 48, 0.92);
    --color-bg-tooltip: #0d1520;
    --color-bg-control: #2a3b52;
    --color-border: #56708a;
    --color-divider: #22303c;
    --color-text: #e8eef5;
    --color-text-muted: #90a4b7;
    --color-text-emphasis: #ffffff;
    --color-text-on-accent: #ffffff;
    --color-accent: #3a6fc2;
    --color-canvas-bg: #0d151d;
    --color-swatch-edge: rgba(255, 255, 255, 0.22);
  }
`;
