// Import Third-party Dependencies
import { unsafeCSS } from "lit";

/**
 * Usage-site fallbacks for essential theme tokens.
 *
 * These only apply when no scope host declared the tokens at all, which is
 * already a degraded state, so `controlBg` is a mode-agnostic translucent grey
 * rather than a value tuned for either scheme.
 */
export const kFallback = {
  /**
   * --jolly-neutral-900
   */
  text: unsafeCSS("#1b2027"),
  /**
   * --jolly-control-bg
   */
  controlBg: unsafeCSS("rgb(128 128 128 / 0.15)"),
  /**
   * --jolly-folder-header-bg
   */
  folderHeaderBg: unsafeCSS("rgb(47 111 216 / 0.12)"),
  /**
   * --jolly-folder-header-bg-hover
   */
  folderHeaderBgHover: unsafeCSS("rgb(47 111 216 / 0.18)"),
  /**
   * --jolly-pane-header-bg
   */
  paneHeaderBg: unsafeCSS("#2f6fd8"),
  /**
   * --jolly-neutral-500
   */
  borderStrong: unsafeCSS("#7b828c"),
  /**
   * --jolly-accent-600
   */
  focusRing: unsafeCSS("#2f6fd8")
} as const;
