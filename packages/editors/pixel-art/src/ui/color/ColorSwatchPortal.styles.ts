/**
 * Re-theme vanilla-picker's global styles under `.color-swatch-portal`.
 * Extra class scoping beats base library selectors without `!important`.
 * State selectors are repeated to avoid tie/order issues with library rules.
 */
export const colorSwatchPortalStyles = `
.color-swatch-portal .picker_wrapper {
  background: var(--color-bg-overlay, #f2f2f2);
  color: var(--color-text, #444);
  border-radius: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}

.color-swatch-portal .picker_wrapper button {
  border-radius: 4px;
  background: var(--color-accent, #2f6fd8);
  background-image: none;
  color: var(--color-text-on-accent, #fff);
  box-shadow: none;
  transition: filter 0.1s ease;
}

.color-swatch-portal .picker_wrapper button:hover {
  background: var(--color-accent, #2f6fd8);
  background-image: none;
  filter: brightness(1.12);
}

.color-swatch-portal .picker_wrapper button:active {
  background: var(--color-accent, #2f6fd8);
  background-image: none;
  filter: brightness(0.9);
  box-shadow: none;
}

.color-swatch-portal .picker_wrapper button:focus {
  box-shadow: none;
}

.color-swatch-portal .picker_wrapper button:focus-visible {
  outline: 2px solid var(--color-accent, #2f6fd8);
  outline-offset: 2px;
}

.color-swatch-portal .picker_editor input {
  border-radius: 4px;
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #444);
  box-shadow: inset 0 0 0 1px var(--color-divider, rgba(0, 0, 0, 0.15));
}

.color-swatch-portal .picker_editor input:active {
  box-shadow: inset 0 0 0 1px var(--color-divider, rgba(0, 0, 0, 0.15));
}

.color-swatch-portal .picker_editor input:focus {
  outline: 2px solid var(--color-accent, #2f6fd8);
  outline-offset: 1px;
  box-shadow: inset 0 0 0 1px var(--color-divider, rgba(0, 0, 0, 0.15));
}

.color-swatch-portal .picker_hue,
.color-swatch-portal .picker_sl {
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px var(--color-divider, rgba(0, 0, 0, 0.15));
}

.color-swatch-portal .picker_alpha,
.color-swatch-portal .picker_sample {
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px var(--color-divider, rgba(0, 0, 0, 0.15));
  background:
    linear-gradient(
      45deg, var(--color-divider, #ccc) 25%, transparent 25%,
      transparent 75%, var(--color-divider, #ccc) 75%
    ) 0 0 / 1.2em 1.2em,
    linear-gradient(
      45deg, var(--color-divider, #ccc) 25%, var(--color-bg-surface, #fff) 25%,
      var(--color-bg-surface, #fff) 75%, var(--color-divider, #ccc) 75%
    ) 0.6em 0.6em / 1.2em 1.2em;
}

.color-swatch-portal .picker_selector {
  border-color: var(--color-text-on-accent, #fff);
  box-shadow: 0 0 0 1px var(--color-accent, #2f6fd8), 0 1px 3px rgba(0, 0, 0, 0.4);
}
`;
