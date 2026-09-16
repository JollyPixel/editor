// Import Third-party Dependencies
import { unsafeCSS } from "lit";

/**
 * Usage-site fallbacks, applied only when no scope host declares the tokens.
 */
export const kFallback = {
  /** --jolly-neutral-900 */
  text: unsafeCSS("#1b2027"),
  /** --jolly-control-bg */
  controlBg: unsafeCSS("rgb(128 128 128 / 0.15)"),
  /** --jolly-folder-header-bg */
  folderHeaderBg: unsafeCSS("rgb(47 111 216 / 0.12)"),
  /** --jolly-folder-header-bg-hover */
  folderHeaderBgHover: unsafeCSS("rgb(47 111 216 / 0.18)"),
  /** --jolly-folder-action-fg */
  folderActionFg: unsafeCSS("#f4f6f8"),
  /** --jolly-folder-action-bg */
  folderActionBg: unsafeCSS("#1b2027"),
  /** --jolly-folder-action-danger-fg */
  folderActionDangerFg: unsafeCSS("#ffffff"),
  /** --jolly-folder-action-danger-bg */
  folderActionDangerBg: unsafeCSS("#c0362c"),
  /** --jolly-pane-header-bg */
  paneHeaderBg: unsafeCSS("#2f6fd8"),
  /** --jolly-tab-close-bg-hover */
  tabCloseBgHover: unsafeCSS("rgb(221 68 51 / 0.22)"),
  /** --jolly-danger-500 */
  inkDanger: unsafeCSS("oklch(58% 0.190 26.4)"),
  /** --jolly-neutral-500 */
  borderStrong: unsafeCSS("#7b828c"),
  /** --jolly-accent-600 */
  focusRing: unsafeCSS("#2f6fd8")
} as const;
