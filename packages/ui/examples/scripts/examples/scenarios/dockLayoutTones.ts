// Import Internal Dependencies
import type { IconTone } from "../../../../src/index.ts";
import type { GalleryExample } from "../../types.ts";
import {
  button,
  dockLayoutStage,
  folder,
  keyedPane
} from "../shared/containerBuilders.ts";

// CONSTANTS
const kStorageKey = "gallery-example:dock-layout-tones";

type DockLayoutTonesOptionKey = "shareTone";

export const DOCK_LAYOUT_TONES_EXAMPLE: GalleryExample<
  DockLayoutTonesOptionKey
> = {
  id: "scenarios/dock-layout-tones",
  title: "Dock layout tones",
  options: [
    {
      key: "shareTone",
      label: "Share tone",
      initial: false
    }
  ],
  render(host, options) {
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
    left.shareTone = options.shareTone;

    const group = document.createElement("jolly-pane-group");
    group.append(
      tonedPane("general", "General", "sky"),
      tonedPane("blocks", "Blocks", "amber")
    );
    const paint = tonedPane("paint", "Paint", "pink");
    paint.slot = "secondary";
    left.append(group, paint);

    const right = document.createElement("jolly-dock");
    right.side = "right";
    right.key = "right";
    right.size = 180;
    right.double = true;
    right.shareTone = options.shareTone;
    right.append(
      tonedPane("layers", "Layers", "violet"),
      keyedPane("assets", "Assets", "An untoned pane follows the accent.")
    );

    layout.append(left, viewport, right);

    host.append(reset, stage);
  }
};

function tonedPane(
  key: string,
  title: string,
  tone: IconTone
): HTMLElementTagNameMap["jolly-pane"] {
  const element = keyedPane(key, title, `This pane is a ${tone} area.`);
  element.tone = tone;
  element.append(folder("Settings"), button("Apply", "accent"));

  return element;
}
