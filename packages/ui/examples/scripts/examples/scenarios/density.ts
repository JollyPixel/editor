// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import type { Density } from "../../../../src/index.ts";
import {
  createScopeHost,
  caption
} from "./scopeHost.ts";

// CONSTANTS
const kDensities: Density[] = [
  "compact",
  "default",
  "comfortable"
];

/**
 * Density is verified once per preset here rather than on every component example, which is what
 * caps the verification cost of three presets across a growing catalog.
 *
 * Each preset needs its own scope host, since the tokens declare against `:host`, and a nested
 * pane overriding its parent is exactly the case this has to support.
 */
export const DENSITY_EXAMPLE: GalleryExample = {
  id: "scenarios/density",
  title: "Density",
  group: "Scenarios",
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

    return () => root.remove();
  }
};

function buildPreset(
  density: Density
): HTMLElement {
  const { host, content } = createScopeHost({
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
