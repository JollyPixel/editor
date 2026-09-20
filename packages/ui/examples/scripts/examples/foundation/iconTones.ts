// Import Third-party Dependencies
import { svg } from "lit";

// Import Internal Dependencies
import {
  ICON_TONES,
  registerIcon
} from "../../../../src/index.ts";
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kHeadings = [
  "tone",
  "swatch",
  "rest",
  "hover me",
  "active",
  "on fill"
];

for (const tone of ICON_TONES) {
  registerIcon(`tone-demo-${tone}`, svg`
    <path
      class="tone-fill"
      d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z"
    />
    <path
      d="M12 3 20 7.5v9L12 21l-8-4.5v-9ZM4 7.5 12 12l8-4.5M12 12v9"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linejoin="round"
    />
    <path
      class="tone-ink"
      d="M17 2v5M14.5 4.5h5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  `, { tone });
}

export const ICON_TONES_EXAMPLE: GalleryExample = {
  id: "foundation/icon-tones",
  title: "Icon tones",
  render(host) {
    const root = document.createElement("div");
    root.className = "tone-demo";

    const toggle = document.createElement("jolly-button");
    toggle.textContent = "Rest strength: muted";
    toggle.dataset.testid = "tone-rest-toggle";
    toggle.addEventListener("click", () => {
      const alwaysOn = root.classList.toggle("is-always-on");
      toggle.textContent = `Rest strength: ${alwaysOn ? "full" : "muted"}`;
    });

    const grid = document.createElement("div");
    grid.className = "tone-grid";
    for (const heading of kHeadings) {
      const cell = document.createElement("span");
      cell.className = "tone-head";
      cell.textContent = heading;
      grid.append(cell);
    }

    for (const tone of ICON_TONES) {
      const name = document.createElement("span");
      name.className = "tone-name";
      name.textContent = tone;

      const swatch = document.createElement("span");
      swatch.className = "tone-swatch";
      swatch.style.background = `var(--jolly-tone-${tone})`;

      const rest = document.createElement("jolly-icon");
      rest.name = `tone-demo-${tone}`;

      const idle = document.createElement("jolly-tool-button");
      idle.icon = `tone-demo-${tone}`;
      idle.label = tone;

      const active = document.createElement("jolly-tool-button");
      active.icon = `tone-demo-${tone}`;
      active.active = true;

      const onFill = document.createElement("span");
      onFill.className = "tone-on-fill";
      const onFillIcon = document.createElement("jolly-icon");
      onFillIcon.name = `tone-demo-${tone}`;
      onFillIcon.onFill = true;
      onFill.append(onFillIcon);

      grid.append(name, swatch, rest, idle, active, onFill);
    }

    root.append(toggle, grid);
    host.append(root);
  }
};
