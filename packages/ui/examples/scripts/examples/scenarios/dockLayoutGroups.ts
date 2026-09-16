// Import Internal Dependencies
import type { IconName } from "../../../../src/index.ts";
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kStorageKey = "gallery-example:dock-layout-groups";

export const DOCK_LAYOUT_GROUPS_EXAMPLE: GalleryExample = {
  id: "scenarios/dock-layout-groups",
  title: "Dock layout groups",
  render(host) {
    const stage = document.createElement("div");
    stage.className = "dock-layout-stage";

    const layout = document.createElement("jolly-dock-layout");
    layout.storageKey = kStorageKey;

    const left = document.createElement("jolly-dock");
    left.side = "left";
    left.key = "left";
    left.size = 260;

    const group = document.createElement("jolly-pane-group");
    group.active = "blocks";
    group.append(
      pane("general", "General", "World settings live here.", "info"),
      pane("blocks", "Blocks", "The block library lives here."),
      pane("paint", "Paint", "The texture editor lives here.")
    );
    left.append(
      group,
      pane("layers", "Layers", "Layers and objects live here.", "eye")
    );

    const viewport = document.createElement("p");
    viewport.className = "dock-layout-viewport";
    viewport.textContent = "Viewport";

    const right = document.createElement("jolly-dock");
    right.side = "right";
    right.key = "right";
    right.size = 240;

    const visible = document.createElement("output");
    visible.className = "dock-layout-visible";
    const shown = new Set<string>();
    layout.addEventListener("jolly-pane-visibility", (event) => {
      if (event.detail.visible) {
        shown.add(event.detail.pane);
      }
      else {
        shown.delete(event.detail.pane);
      }
      visible.value = [...shown].sort().join(" ");
    });

    layout.append(left, viewport, right);

    const reset = document.createElement("jolly-button");
    reset.textContent = "Reset layout";
    reset.dataset.action = "reset-layout";
    reset.addEventListener("click", () => layout.resetLayout());

    stage.append(layout);
    host.append(reset, visible, stage);
  }
};

function pane(
  key: string,
  title: string,
  content: string,
  icon: IconName = ""
): HTMLElementTagNameMap["jolly-pane"] {
  const element = document.createElement("jolly-pane");
  element.key = key;
  element.heading = title;
  element.icon = icon;
  element.collapsible = true;
  const body = document.createElement("p");
  body.textContent = content;
  element.append(body);

  return element;
}
