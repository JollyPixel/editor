// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import type { ThemeMode } from "../../../../src/index.ts";
import {
  createScopedHost,
  caption
} from "../shared/scopedHost.ts";

// CONSTANTS
const kThemes: ThemeMode[] = [
  "light",
  "dark"
];

export const THEME_EXAMPLE: GalleryExample = {
  id: "scenarios/theme",
  title: "Theme",
  render(host) {
    const root = document.createElement("div");
    root.className = "scenario-grid";

    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent = "Two panes on one page, each carrying its own theme.";
    root.append(hint);

    for (const theme of kThemes) {
      root.append(
        buildPane(theme)
      );
    }

    host.append(root);
  }
};

function buildPane(
  theme: ThemeMode
): HTMLElement {
  const { host, content } = createScopedHost({
    theme
  });

  const text = document.createElement("jolly-text");
  text.label = "Name";
  text.value = "Background";

  const color = document.createElement("jolly-color");
  color.label = "Tint";
  color.value = "#4488ff";

  const group = document.createElement("jolly-button-group");
  group.label = "Tool";
  group.options = [
    {
      value: "move",
      label: "Move"
    },
    {
      value: "paint",
      label: "Paint"
    }
  ];
  group.value = "move";

  content.append(
    caption(theme),
    text,
    color,
    group
  );

  return host;
}
