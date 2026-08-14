// Import Internal Dependencies
import type { GalleryExample } from "./types.ts";

import { TOKENS_EXAMPLE } from "./examples/tokens.ts";
import { PEER_COLORS_EXAMPLE } from "./examples/peerColors.ts";
import { PRESENCE_EXAMPLE } from "./examples/presence.ts";
import { TEXT_EXAMPLE } from "./examples/controls/text.ts";
import { NUMBER_EXAMPLE } from "./examples/controls/number.ts";
import { CHECKBOX_EXAMPLE } from "./examples/controls/checkbox.ts";
import { SLIDER_EXAMPLE } from "./examples/controls/slider.ts";
import { RANGE_EXAMPLE } from "./examples/controls/range.ts";
import { FLAGS_EXAMPLE } from "./examples/controls/flags.ts";
import { SELECT_EXAMPLE } from "./examples/controls/select.ts";
import {
  COLOR_EXAMPLE,
  COLOR_ALPHA_EXAMPLE
} from "./examples/controls/color.ts";
import { COLOR_PICKER_EXAMPLE } from "./examples/controls/colorPicker.ts";
import { BUTTON_GROUP_EXAMPLE } from "./examples/controls/buttonGroup.ts";
import { CONTROLS_EXAMPLE } from "./examples/controls/controls.ts";
import { CHROME_EXAMPLE } from "./examples/controls/chrome.ts";
import { PANE_EXAMPLE } from "./examples/containers/pane.ts";
import { FOLDER_EXAMPLE } from "./examples/containers/folder.ts";
import { TABS_EXAMPLE } from "./examples/containers/tabs.ts";
import { TAB_EXAMPLE } from "./examples/containers/tab.ts";
import { DOCK_EXAMPLE } from "./examples/containers/dock.ts";
import { FLOATING_EXAMPLE } from "./examples/containers/floating.ts";
import { DIALOG_EXAMPLE } from "./examples/containers/dialog.ts";
import { TOOLBAR_EXAMPLE } from "./examples/containers/toolbar.ts";
import { RAIL_EXAMPLE } from "./examples/containers/rail.ts";
import { DENSITY_EXAMPLE } from "./examples/scenarios/density.ts";
import { THEME_EXAMPLE } from "./examples/scenarios/theme.ts";
import { NUMERIC_ENTRY_EXAMPLE } from "./examples/scenarios/numericEntry.ts";
import { STEP_SIZES_EXAMPLE } from "./examples/scenarios/stepSizes.ts";
import { COLOR_POPOVER_EXAMPLE } from "./examples/scenarios/colorPopover.ts";
import { REORDER_PERSIST_EXAMPLE } from "./examples/scenarios/reorderPersistence.ts";
import { DOCK_RESIZE_EXAMPLE } from "./examples/scenarios/dockResize.ts";
import { DOCK_LAYOUT_EXAMPLE } from "./examples/scenarios/dockLayout.ts";
import { DOCK_LAYOUT_TRANSPARENT_EXAMPLE } from "./examples/scenarios/dockLayoutTransparent.ts";
import { DIALOG_ESCAPE_EXAMPLE } from "./examples/scenarios/dialogEscape.ts";
import {
  EDITOR_EXAMPLE,
  EDITOR_STATES_EXAMPLE
} from "./examples/scenarios/editor.ts";
import { MONITOR_EXAMPLE } from "./examples/monitors/monitor.ts";
import { GRAPH_EXAMPLE } from "./examples/monitors/graph.ts";
import { FACADE_PARITY_EXAMPLE } from "./examples/scenarios/facadeParity.ts";
import { PROGRESS_EXAMPLE } from "./examples/feedback/progress.ts";

/**
 * The navigation and E2E sweep derive from this list.
 */
export const manifest: readonly GalleryExample[] = [
  TOKENS_EXAMPLE,
  PEER_COLORS_EXAMPLE,
  PRESENCE_EXAMPLE,
  TEXT_EXAMPLE,
  NUMBER_EXAMPLE,
  CHECKBOX_EXAMPLE,
  SLIDER_EXAMPLE,
  RANGE_EXAMPLE,
  FLAGS_EXAMPLE,
  SELECT_EXAMPLE,
  COLOR_EXAMPLE,
  COLOR_ALPHA_EXAMPLE,
  COLOR_PICKER_EXAMPLE,
  BUTTON_GROUP_EXAMPLE,
  CONTROLS_EXAMPLE,
  CHROME_EXAMPLE,
  PANE_EXAMPLE,
  FOLDER_EXAMPLE,
  TABS_EXAMPLE,
  TAB_EXAMPLE,
  DOCK_EXAMPLE,
  FLOATING_EXAMPLE,
  DIALOG_EXAMPLE,
  TOOLBAR_EXAMPLE,
  RAIL_EXAMPLE,
  DENSITY_EXAMPLE,
  THEME_EXAMPLE,
  NUMERIC_ENTRY_EXAMPLE,
  STEP_SIZES_EXAMPLE,
  COLOR_POPOVER_EXAMPLE,
  REORDER_PERSIST_EXAMPLE,
  DOCK_RESIZE_EXAMPLE,
  DOCK_LAYOUT_EXAMPLE,
  DOCK_LAYOUT_TRANSPARENT_EXAMPLE,
  DIALOG_ESCAPE_EXAMPLE,
  EDITOR_EXAMPLE,
  EDITOR_STATES_EXAMPLE,
  FACADE_PARITY_EXAMPLE,
  MONITOR_EXAMPLE,
  GRAPH_EXAMPLE,
  PROGRESS_EXAMPLE
];

export function findExample(
  id: string | null
): GalleryExample {
  return manifest.find(
    (example) => example.id === id
  ) ?? manifest[0];
}
