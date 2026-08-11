// Import Third-party Dependencies
import { unsafeCSS } from "lit";

/**
 * Usage-site fallbacks for essential theme tokens.
 */
export const kFallback = {
  /**
   * --jolly-neutral-900
   */
  text: unsafeCSS("#1b2027"),
  /**
   * --jolly-neutral-0
   */
  controlBg: unsafeCSS("#ffffff"),
  /**
   * --jolly-neutral-500
   */
  borderStrong: unsafeCSS("#7b828c"),
  /**
   * --jolly-accent-600
   */
  focusRing: unsafeCSS("#2f6fd8")
} as const;
