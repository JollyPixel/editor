// Import Internal Dependencies
import type { GalleryExample } from "../types.ts";

// CONSTANTS
const kSemanticTokens = [
  "--jolly-surface",
  "--jolly-surface-sunken",
  "--jolly-surface-raised",
  "--jolly-control-bg",
  "--jolly-control-bg-hover",
  "--jolly-control-bg-active",
  "--jolly-border",
  "--jolly-border-strong",
  "--jolly-text",
  "--jolly-text-muted",
  "--jolly-text-on-fill",
  "--jolly-accent-fill",
  "--jolly-accent-text",
  "--jolly-focus-ring",
  "--jolly-danger",
  "--jolly-warning",
  "--jolly-success"
];

/** Renders the semantic tier against the current theme, so a token override shows up here first. */
export const TOKENS_EXAMPLE: GalleryExample = {
  id: "foundation/tokens",
  title: "Semantic tokens",
  group: "Foundation",
  render(host) {
    const grid = document.createElement("div");
    grid.className = "token-grid";

    for (const token of kSemanticTokens) {
      const row = document.createElement("div");
      row.className = "token-row";

      const swatch = document.createElement("span");
      swatch.className = "token-swatch";
      swatch.style.background = `var(${token})`;

      const name = document.createElement("code");
      name.textContent = token;

      row.append(swatch, name);
      grid.append(row);
    }

    host.append(grid);
  }
};
