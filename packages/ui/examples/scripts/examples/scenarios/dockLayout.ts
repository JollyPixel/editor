// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kStorageKey = "gallery-example:dock-layout";

export const DOCK_LAYOUT_EXAMPLE: GalleryExample = {
  id: "scenarios/dock-layout",
  title: "Dock layout",
  render(host) {
    const stage = document.createElement("div");
    stage.className = "dock-layout-stage";

    const layout = document.createElement("jolly-dock-layout");
    layout.storageKey = kStorageKey;

    const left = document.createElement("jolly-dock");
    left.side = "left";
    left.align = "start";
    left.key = "left";
    left.collapsible = true;
    left.append(
      pane("hierarchy", "Hierarchy", "Scene nodes live here."),
      pane("inspector", "Inspector", "Component properties live here.")
    );

    const right = document.createElement("jolly-dock");
    right.side = "right";
    right.overlay = true;
    right.align = "end";
    right.key = "right";
    right.size = 220;
    const hud = pane("hud", "HUD", "Overlay panels float over the viewport.");
    const display = document.createElement("jolly-folder");
    display.label = "Display";
    display.append("Frame counters.");
    hud.append(display);
    right.append(hud);

    const viewport = document.createElement("p");
    viewport.className = "dock-layout-viewport";
    viewport.textContent = "Viewport";

    const floating = document.createElement("jolly-floating");
    floating.x = 360;
    floating.y = 140;
    floating.width = 260;
    floating.height = 180;
    floating.append(pane("assets", "Assets", "Dragged out of a dock."));

    layout.append(left, viewport, right, floating);

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
  element.collapsible = true;
  const body = document.createElement("p");
  body.textContent = content;
  element.append(body);

  return element;
}
