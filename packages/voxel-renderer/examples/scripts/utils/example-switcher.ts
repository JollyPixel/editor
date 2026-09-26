// Import Third-party Dependencies
import {
  DockFacade,
  Pane
} from "@jolly-pixel/ui";

// CONSTANTS
const kDefaultTitle = "voxel.renderer";
const kToggleKey = "F3";
/** Label → path, as consumed by the switcher's `options`. */
const kExamples: Record<string, string> = {
  Physics: "/",
  "Block Shapes": "/shapes.html",
  "Tileset UV": "/tileset.html",
  "Noise World": "/noise-world.html",
  "Transparency & Light": "/transparency.html"
};

export interface ExamplePaneOptions {
  /**
   * @default "voxel.renderer"
   */
  title?: string;
}

export function createExamplePane(
  options: ExamplePaneOptions = {}
): Pane {
  const { title = kDefaultTitle } = options;

  const dock = DockFacade.query("#tools");
  const chrome = new Pane({
    title: "Configuration",
    container: dock.element,
    grow: false,
    locked: true
  });
  const current = currentExample();

  chrome
    .addBinding({ example: current }, "example", {
      options: kExamples,
      label: "Current"
    })
    .on("change", ({ value }) => {
      if (value !== current) {
        window.location.assign(value);
      }
    });

  chrome.addThemePreferences({ storageKey: "voxel-renderer-examples" });

  const pane = new Pane({
    title,
    container: dock.element,
    grow: false,
    collapsible: true
  });

  dock.sync();

  document.addEventListener("keydown", (event) => {
    if (event.key !== kToggleKey) {
      return;
    }

    event.preventDefault();
    dock.hidden = !dock.hidden;
  });

  return pane;
}

function currentExample(): string {
  const { pathname } = window.location;

  return pathname === "/index.html" ? "/" : pathname;
}
