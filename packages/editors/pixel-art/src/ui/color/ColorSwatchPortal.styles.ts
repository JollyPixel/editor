/**
 * Chrome for the portal card plus a `--jolly-*` -> `--color-*` bridge, so
 * `jolly-color-picker` (a @jolly-pixel/ui component with no scope host of
 * its own here) inherits pixel-art's theme instead of its own defaults.
 * Only tokens `colorPickerStyles` reads without a usable fallback are
 * bridged, and only from custom properties `ColorSwatchPortal#syncTheme()`
 * already copies onto this element.
 *
 * `jolly-color-picker` sets `font-family: inherit; font-size: inherit;` on
 * its own :host (it expects a scope host or field to have already set the
 * literal properties), so those need setting here too, or it inherits the
 * page's default font instead of the bundled Roboto Mono face.
 */
export const colorSwatchPortalStyles = `
.color-swatch-portal {
  padding: 8px;
  border-radius: 6px;
  background: var(--color-bg-overlay, #f2f2f2);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  font-family: "Roboto Mono", ui-monospace, sfmono-regular, "Cascadia Code", consolas, monospace;
  font-size: 11px;

  --jolly-ink: var(--color-text);
  --jolly-text: var(--color-text);
  --jolly-surface-raised: var(--color-bg-overlay);
  --jolly-control-bg: var(--color-bg-surface);
  --jolly-control-bg-hover: var(--color-divider);
  --jolly-control-bg-focus: var(--color-border);
  --jolly-focus-ring: var(--color-accent);
}
`;
