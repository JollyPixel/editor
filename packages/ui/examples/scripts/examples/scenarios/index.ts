// Import Internal Dependencies
import type { GalleryEntry } from "../../types.ts";

export const SCENARIOS_EXAMPLES: readonly GalleryEntry[] = [
  {
    id: "scenarios/scoped-hosts",
    title: "Scoped density and theme",
    load: async() => (await import("./scopedHosts.ts")).SCOPED_HOSTS_EXAMPLE
  },
  {
    id: "scenarios/step-sizes",
    title: "Step sizes",
    load: async() => (await import("./stepSizes.ts")).STEP_SIZES_EXAMPLE
  },
  {
    id: "scenarios/color-popover",
    title: "Picker in a popup",
    load: async() => (await import("./colorPopover.ts")).COLOR_POPOVER_EXAMPLE
  },
  {
    id: "scenarios/reorder-persist",
    title: "Reorder persistence",
    load: async() => (await import("./reorderPersistence.ts")).REORDER_PERSIST_EXAMPLE
  },
  {
    id: "scenarios/dock-resize",
    title: "Dock and floating placement",
    load: async() => (await import("./dockResize.ts")).DOCK_RESIZE_EXAMPLE
  },
  {
    id: "scenarios/dock-layout",
    title: "Dock layout",
    load: async() => (await import("./dockLayout.ts")).DOCK_LAYOUT_EXAMPLE
  },
  {
    id: "scenarios/dock-layout-groups",
    title: "Dock layout groups",
    load: async() => (await import("./dockLayoutGroups.ts")).DOCK_LAYOUT_GROUPS_EXAMPLE
  },
  {
    id: "scenarios/dock-layout-double",
    title: "Dock layout double",
    load: async() => (await import("./dockLayoutDouble.ts")).DOCK_LAYOUT_DOUBLE_EXAMPLE
  },
  {
    id: "scenarios/dock-layout-tones",
    title: "Dock layout tones",
    load: async() => (await import("./dockLayoutTones.ts")).DOCK_LAYOUT_TONES_EXAMPLE
  },
  {
    id: "scenarios/dock-layout-transparent",
    title: "Dock layout transparent",
    load: async() => (await import("./dockLayoutTransparent.ts")).DOCK_LAYOUT_TRANSPARENT_EXAMPLE
  },
  {
    id: "scenarios/dialog-escape",
    title: "Dialog Escape",
    load: async() => (await import("./dialogEscape.ts")).DIALOG_ESCAPE_EXAMPLE
  },
  {
    id: "scenarios/locking",
    title: "Locking",
    load: async() => (await import("./locking.ts")).LOCKING_EXAMPLE
  },
  {
    id: "scenarios/editor",
    title: "Editor",
    load: async() => (await import("./editor.ts")).EDITOR_EXAMPLE
  },
  {
    id: "scenarios/facade",
    title: "Facade",
    load: async() => (await import("./facade.ts")).FACADE_EXAMPLE
  },
  {
    id: "scenarios/stats-cycle",
    title: "Stats cycle",
    load: async() => (await import("./statsCycle.ts")).STATS_CYCLE_EXAMPLE
  },
  {
    id: "scenarios/mixed-per-axis",
    title: "Mixed per axis",
    load: async() => (await import("./mixedPerAxis.ts")).MIXED_PER_AXIS_EXAMPLE
  },
  {
    id: "scenarios/unlabeled-fields",
    title: "Unlabeled fields",
    load: async() => (await import("./unlabeledFields.ts")).UNLABELED_FIELDS_EXAMPLE
  },
  {
    id: "scenarios/field-layout",
    title: "Field layout",
    load: async() => (await import("./fieldLayout.ts")).FIELD_LAYOUT_EXAMPLE
  }
];
