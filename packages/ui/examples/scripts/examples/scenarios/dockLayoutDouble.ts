// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  dockLayoutStage,
  keyedPane
} from "../shared/containerBuilders.ts";

// CONSTANTS
const kStorageKey = "gallery-example:dock-layout-double";

export const DOCK_LAYOUT_DOUBLE_EXAMPLE: GalleryExample = {
  id: "scenarios/dock-layout-double",
  title: "Dock layout double",
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
    left.size = 200;
    left.double = true;
    left.collapsible = true;

    const group = document.createElement("jolly-pane-group");
    group.append(
      keyedPane("general", "General", "World settings live here."),
      keyedPane("blocks", "Blocks", "The block library lives here.")
    );
    left.append(
      group,
      keyedPane("paint", "Paint", "The texture editor lives here."),
      keyedPane("layers", "Layers", "Layers and objects live here.")
    );

    const right = document.createElement("jolly-dock");
    right.side = "right";
    right.key = "right";
    right.size = 180;
    right.double = true;
    right.append(
      keyedPane("inspector", "Inspector", "Properties live here."),
      keyedPane("assets", "Assets", "Assets live here.")
    );

    layout.append(left, viewport, right);

    host.append(reset, stage);
  }
};
