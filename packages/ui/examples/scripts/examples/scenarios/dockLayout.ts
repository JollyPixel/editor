// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  dockLayoutStage,
  keyedPane
} from "../shared/containerBuilders.ts";

// CONSTANTS
const kStorageKey = "gallery-example:dock-layout";
const kCollapsible = {
  collapsible: true
};

export const DOCK_LAYOUT_EXAMPLE: GalleryExample = {
  id: "scenarios/dock-layout",
  title: "Dock layout",
  render(host) {
    const {
      layout,
      stage,
      viewport,
      reset
    } = dockLayoutStage(kStorageKey);

    const left = document.createElement("jolly-dock");
    left.side = "left";
    left.align = "start";
    left.key = "left";
    left.collapsible = true;
    left.append(
      keyedPane("hierarchy", "Hierarchy", "Scene nodes live here.", kCollapsible),
      keyedPane("inspector", "Inspector", "Component properties live here.", kCollapsible)
    );

    const right = document.createElement("jolly-dock");
    right.side = "right";
    right.overlay = true;
    right.align = "end";
    right.key = "right";
    right.size = 220;
    const hud = keyedPane("hud", "HUD", "Overlay panels float over the viewport.", kCollapsible);
    const display = document.createElement("jolly-folder");
    display.label = "Display";
    display.append("Frame counters.");
    hud.append(display);
    right.append(hud);

    const floating = document.createElement("jolly-floating");
    floating.x = 360;
    floating.y = 140;
    floating.width = 260;
    floating.height = 180;
    floating.append(keyedPane("assets", "Assets", "Dragged out of a dock.", kCollapsible));

    layout.append(left, viewport, right, floating);

    host.append(reset, stage);
  }
};
