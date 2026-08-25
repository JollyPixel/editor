---
status: accepted
---

# Tokens are declared once on scope hosts, using `light-dark()`

Design tokens are declared on a scope host (`jolly-pane`, `jolly-dialog`) with `light-dark()`, and
the `theme` attribute only flips `color-scheme`. Each token therefore has exactly one declaration,
replacing pixel-art's three declarations of each of its 13 tokens, and custom properties inherit
through shadow roots so consumers override with plain CSS and no piercing.

A leaf component must not declare inherited tokens on `:host`. It blocks consumer overrides, and
re-declaring the block re-declares `color-scheme: light dark`, which resets the scheme inherited
from the scope host — the nested element silently drops back to the system preference.

## Considered Options

- **A global `:root` stylesheet.** One theme per document, and an element renders unstyled without
  the import. Scoped hosts allow multiple themes on one page.
- **Tokens on every component's `:host`.** Overriding one token means targeting every tag, and
  nested elements shadow the override.
- **Fallbacks on every token usage.** Re-inlines the palette across every stylesheet, and a single
  fallback value cannot carry `light-dark()`. Fallbacks are limited to four names in
  `src/theme/fallbacks.ts`.
