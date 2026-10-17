// Import Third-party Dependencies
import { unsafeCSS } from "lit";

export const kFallback = {
  text: unsafeCSS("#1b2027"),
  controlBg: unsafeCSS("rgb(128 128 128 / 0.15)"),
  folderHeaderBg: unsafeCSS("rgb(47 111 216 / 0.12)"),
  folderHeaderBgHover: unsafeCSS("rgb(47 111 216 / 0.18)"),
  folderActionFg: unsafeCSS("#1b2027"),
  folderActionBg: unsafeCSS("rgb(47 111 216 / 0.22)"),
  folderActionDangerFg: unsafeCSS("#c0362c"),
  folderActionDangerBg: unsafeCSS("rgb(192 54 44 / 0.16)"),
  paneHeaderBg: unsafeCSS("#2f6fd8"),
  tabCloseBgHover: unsafeCSS("rgb(221 68 51 / 0.22)"),
  tabBadgeBg: unsafeCSS("oklch(70% 0.125 75deg / 0.24)"),
  tabBadgeFg: unsafeCSS("oklch(70% 0.125 75deg)"),
  inkDanger: unsafeCSS("oklch(58% 0.190 26.4)"),
  borderStrong: unsafeCSS("#7b828c"),
  focusRing: unsafeCSS("#2f6fd8"),
  scrim: unsafeCSS("light-dark(rgb(30 38 52 / 46%), rgb(5 10 18 / 62%))")
} as const;
