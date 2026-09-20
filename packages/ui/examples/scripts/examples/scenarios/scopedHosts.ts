// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  createScopedHost,
  caption
} from "../shared/scopedHost.ts";

// CONSTANTS
const kScopes: Record<string, string>[] = [
  { density: "compact" },
  { density: "default" },
  { density: "comfortable" },
  { theme: "light" },
  { theme: "dark" }
];

export const SCOPED_HOSTS_EXAMPLE: GalleryExample = {
  id: "scenarios/scoped-hosts",
  title: "Scoped density and theme",
  render(host) {
    const root = document.createElement("div");
    root.className = "scenario-grid";

    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent = "Each pane is its own scope host, carrying one density or theme.";

    root.append(hint, ...kScopes.map(buildScope));
    host.append(root);
  }
};

function buildScope(
  attributes: Record<string, string>
): HTMLElement {
  const { host, content } = createScopedHost(attributes);

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

  const color = document.createElement("jolly-color");
  color.label = "Tint";
  color.value = "#4488ff";

  content.append(
    caption(Object.values(attributes).join(" ")),
    text,
    number,
    check,
    color
  );

  return host;
}
