// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import type { Density } from "../../../../src/index.ts";
import {
  createScopedHost,
  caption
} from "../shared/scopedHost.ts";

// CONSTANTS
const kDensities: Density[] = [
  "compact",
  "default",
  "comfortable"
];

export const DENSITY_EXAMPLE: GalleryExample = {
  id: "scenarios/density",
  title: "Density",
  render(host) {
    const root = document.createElement("div");
    root.className = "scenario-grid";

    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent = "Row height and font size per preset. Each pane is its own scope host.";
    root.append(hint);

    for (const density of kDensities) {
      root.append(
        buildPreset(density)
      );
    }

    host.append(root);
  }
};

function buildPreset(
  density: Density
): HTMLElement {
  const { host, content } = createScopedHost({
    density
  });

  const text = document.createElement("jolly-text");
  text.label = "Name";
  text.value = "Background";

  const number = document.createElement("jolly-number");
  number.label = "Opacity";
  number.step = 0.01;
  number.value = 0.5;

  const check = document.createElement("jolly-checkbox");
  check.label = "Visible";
  check.value = true;

  content.append(
    caption(density),
    text,
    number,
    check
  );

  return host;
}
