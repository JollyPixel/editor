// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  dockLayoutStage,
  keyedPane
} from "../shared/containerBuilders.ts";

// CONSTANTS
const kStorageKey = "gallery-example:dock-layout-groups";
const kCollapsible = {
  collapsible: true
};

export const DOCK_LAYOUT_GROUPS_EXAMPLE: GalleryExample = {
  id: "scenarios/dock-layout-groups",
  title: "Dock layout groups",
  render(host) {
    const {
      layout,
      stage,
      viewport,
      reset
    } = dockLayoutStage(kStorageKey);

    const left = document.createElement("jolly-dock");
    left.side = "left";
    left.key = "left";
    left.size = 260;

    const paint = keyedPane("paint", "Paint", "The texture editor lives here.", kCollapsible);
    paint.floatWidth = 300;
    paint.floatHeight = 420;

    const group = document.createElement("jolly-pane-group");
    group.active = "blocks";
    group.append(
      keyedPane("general", "General", "World settings live here.", {
        icon: "info",
        collapsible: true
      }),
      keyedPane("blocks", "Blocks", "The block library lives here.", kCollapsible),
      paint
    );
    left.append(
      group,
      keyedPane("layers", "Layers", "Layers and objects live here.", {
        icon: "eye",
        collapsible: true
      })
    );

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

    host.append(reset, visible, stage);
  }
};
