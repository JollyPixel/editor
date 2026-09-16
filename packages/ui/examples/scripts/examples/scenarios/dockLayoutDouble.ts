// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kStorageKey = "gallery-example:dock-layout-double";

export const DOCK_LAYOUT_DOUBLE_EXAMPLE: GalleryExample = {
  id: "scenarios/dock-layout-double",
  title: "Dock layout double",
  render(host) {
    const stage = document.createElement("div");
    stage.className = "dock-layout-stage";

    const layout = document.createElement("jolly-dock-layout");
    layout.storageKey = kStorageKey;

    const left = document.createElement("jolly-dock");
    left.side = "left";
    left.key = "left";
    left.size = 200;
    left.double = true;
    left.collapsible = true;

    const group = document.createElement("jolly-pane-group");
    group.append(
      pane("general", "General", "World settings live here."),
      pane("blocks", "Blocks", "The block library lives here.")
    );
    left.append(
      group,
      pane("paint", "Paint", "The texture editor lives here."),
      pane("layers", "Layers", "Layers and objects live here.")
    );

    const viewport = document.createElement("p");
    viewport.className = "dock-layout-viewport";
    viewport.textContent = "Viewport";

    const right = document.createElement("jolly-dock");
    right.side = "right";
    right.key = "right";
    right.size = 180;
    right.double = true;
    right.append(
      pane("inspector", "Inspector", "Properties live here."),
      pane("assets", "Assets", "Assets live here.")
    );

    layout.append(left, viewport, right);

    const reset = document.createElement("jolly-button");
    reset.textContent = "Reset layout";
    reset.dataset.action = "reset-layout";
    reset.addEventListener("click", () => layout.resetLayout());

    stage.append(layout);
    host.append(reset, stage);
  }
};

function pane(
  key: string,
  title: string,
  content: string
): HTMLElementTagNameMap["jolly-pane"] {
  const element = document.createElement("jolly-pane");
  element.key = key;
  element.heading = title;
  const body = document.createElement("p");
  body.textContent = content;
  element.append(body);

  return element;
}
