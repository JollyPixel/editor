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
  "Tiled Map": "/tiled.html",
  "Noise World": "/noise-world.html",
  "Flat World (Sync)": "/flat-world.html",
  "Transparency & Light": "/transparency.html"
};

export interface ExamplePaneOptions {
  /**
   * @default "voxel.renderer"
   */
  title?: string;
}

/**
 * Two stacked panes in the same dock, docked to the right edge: a compact
 * chrome pane (page switcher, theme, density) above the pane this returns,
 * which grows to fill the rest and scrolls its own content. `F3` toggles the
 * whole dock. The dock and its `jolly-scope` theme host are declared in each
 * page's HTML.
 */
export function createExamplePane(
  options: ExamplePaneOptions = {}
): Pane {
  const { title = kDefaultTitle } = options;

  const dockElement = document.querySelector<HTMLElementTagNameMap["jolly-dock"]>("#tools");
  if (dockElement === null) {
    throw new Error("createExamplePane: no #tools jolly-dock in this page's HTML");
  }
  const dock = DockFacade.from(dockElement);

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

  const preferences = document.createElement("jolly-theme-preferences");
  // Two rows at the top of the pane rather than flattened into it, see
  // @jolly-pixel/ui docs/api/theme/theme-preferences.md.
  preferences.layout = "stack";
  preferences.storageKey = "voxel-renderer-examples";
  chrome.element.append(preferences);

  // Not `grow`: it would claim leftover flex space even with little content.
  // `max-height: 100%` in main.css caps it instead, so it only scrolls its
  // own content once that would otherwise exceed the dock.
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

/**
 * `/index.html` and `/` are the same page; the switcher only knows the latter.
 */
function currentExample(): string {
  const { pathname } = window.location;

  return pathname === "/index.html" ? "/" : pathname;
}
