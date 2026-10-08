// Import Internal Dependencies
import type { GalleryEntry } from "../../types.ts";

export const CONTAINERS_EXAMPLES: readonly GalleryEntry[] = [
  {
    id: "containers/pane",
    title: "Pane",
    load: async() => (await import("./pane.ts")).PANE_EXAMPLE
  },
  {
    id: "containers/folder",
    title: "Folder",
    load: async() => (await import("./folder.ts")).FOLDER_EXAMPLE
  },
  {
    id: "containers/tabs",
    title: "Tabs",
    load: async() => (await import("./tabs.ts")).TABS_EXAMPLE
  },
  {
    id: "containers/dock",
    title: "Dock",
    load: async() => (await import("./dock.ts")).DOCK_EXAMPLE
  },
  {
    id: "containers/floating",
    title: "Floating",
    load: async() => (await import("./floating.ts")).FLOATING_EXAMPLE
  },
  {
    id: "containers/dialog",
    title: "Dialog",
    load: async() => (await import("./dialog.ts")).DIALOG_EXAMPLE
  },
  {
    id: "containers/context-menu",
    title: "Context menu",
    load: async() => (await import("./context-menu.ts")).CONTEXT_MENU_EXAMPLE
  },
  {
    id: "containers/toolbar",
    title: "Toolbar",
    load: async() => (await import("./toolbar.ts")).TOOLBAR_EXAMPLE
  },
  {
    id: "containers/rail",
    title: "Rail",
    load: async() => (await import("./rail.ts")).RAIL_EXAMPLE
  }
];
