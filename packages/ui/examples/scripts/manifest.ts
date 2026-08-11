// Import Internal Dependencies
import type { GalleryExample } from "./types.ts";

import { TOKENS_EXAMPLE } from "./examples/tokens.ts";
import { PEER_COLORS_EXAMPLE } from "./examples/peerColors.ts";
import { TEXT_EXAMPLE } from "./examples/controls/text.ts";
import { NUMBER_EXAMPLE } from "./examples/controls/number.ts";
import { CHECKBOX_EXAMPLE } from "./examples/controls/checkbox.ts";
import { SLIDER_EXAMPLE } from "./examples/controls/slider.ts";
import { RANGE_EXAMPLE } from "./examples/controls/range.ts";
import { FLAGS_EXAMPLE } from "./examples/controls/flags.ts";
import { SELECT_EXAMPLE } from "./examples/controls/select.ts";
import { COLOR_EXAMPLE } from "./examples/controls/color.ts";
import { BUTTON_GROUP_EXAMPLE } from "./examples/controls/buttonGroup.ts";
import { CHROME_EXAMPLE } from "./examples/controls/chrome.ts";
import { DENSITY_EXAMPLE } from "./examples/scenarios/density.ts";
import { THEME_EXAMPLE } from "./examples/scenarios/theme.ts";
import { NUMERIC_ENTRY_EXAMPLE } from "./examples/scenarios/numericEntry.ts";
import { STEP_SIZES_EXAMPLE } from "./examples/scenarios/stepSizes.ts";
import {
  EDITOR_EXAMPLE,
  EDITOR_STATES_EXAMPLE
} from "./examples/scenarios/editor.ts";
import {
  PANE_EXAMPLE,
  FOLDER_EXAMPLE,
  TABS_EXAMPLE,
  TAB_EXAMPLE,
  DOCK_EXAMPLE,
  FLOATING_EXAMPLE,
  DIALOG_EXAMPLE,
  TOOLBAR_EXAMPLE,
  RAIL_EXAMPLE,
  REORDER_PERSIST_EXAMPLE,
  DOCK_RESIZE_EXAMPLE,
  DIALOG_ESCAPE_EXAMPLE
} from "./examples/containers.ts";

/** The nav and the e2e sweep both derive from this list, so adding a file adds an entry. */
export const manifest: readonly GalleryExample[] = [
  TOKENS_EXAMPLE,
  PEER_COLORS_EXAMPLE,
  TEXT_EXAMPLE,
  NUMBER_EXAMPLE,
  CHECKBOX_EXAMPLE,
  SLIDER_EXAMPLE,
  RANGE_EXAMPLE,
  FLAGS_EXAMPLE,
  SELECT_EXAMPLE,
  COLOR_EXAMPLE,
  BUTTON_GROUP_EXAMPLE,
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
  REORDER_PERSIST_EXAMPLE,
  DOCK_RESIZE_EXAMPLE,
  DIALOG_ESCAPE_EXAMPLE,
  EDITOR_EXAMPLE,
  EDITOR_STATES_EXAMPLE
];

export function findExample(
  id: string | null
): GalleryExample {
  return manifest.find(
    (example) => example.id === id
  ) ?? manifest[0];
}
