// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  placementDock,
  placementPane,
  text
} from "../shared/containerBuilders.ts";

/**
 * A layout owns the three containers, so the floating pane can be dragged into
 * either dock and back out again, not merely moved around the stage.
 */
export const DOCK_RESIZE_EXAMPLE: GalleryExample = {
  id: "scenarios/dock-resize",
  title: "Dock and floating placement",
  group: "Scenarios",
  render(host) {
    const stage = document.createElement("div");
    stage.className = "placement-stage";

    const layout = document.createElement("jolly-dock-layout");
    layout.storageKey = "gallery-example:placement";

    const viewport = text("Viewport content");
    viewport.className = "placement-viewport";

    const floating = document.createElement("jolly-floating");
    floating.x = 320;
    floating.y = 120;
    floating.width = 280;
    floating.height = 220;
    floating.append(
      placementPane("floating", "Floating pane", "Drag my header into either dock.")
    );

    layout.append(
      placementDock("left"),
      viewport,
      placementDock("right"),
      floating
    );
    stage.append(layout);
    host.append(stage);

    return () => stage.remove();
  }
};
