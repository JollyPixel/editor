// Import Third-party Dependencies
import {
  DockFacade,
  Pane
} from "@jolly-pixel/ui";

// CONSTANTS
const kDefaultTitle = "three";
const kToggleKey = "F3";
/** Label → path, as consumed by the switcher's `options`. */
const kExamples: Record<string, string> = {
  Grid: "/",
  "Area Box": "/area-box.html",
  "Peer Frustum": "/peer-frustum.html",
  "Peer Frustum Sync": "/peer-frustum-sync.html",
  Selection: "/selection.html",
  "Peer Selection": "/peer-selection.html",
  Stress: "/stress.html"
};

export interface ExamplePaneOptions {
  /**
   * @default "three"
   */
  title?: string;
}

/**
 * Two stacked panes in the same dock, docked to the right edge: a compact
 * chrome pane (page switcher, theme, density) above the pane this returns,
 * which grows to fill the rest and scrolls its own content. `F3` toggles the
 * whole dock. The dock and its `jolly-scope` theme host are declared in each
 * page's HTML; see `examples/index.html`.
 */
export function createExamplePane(
  options: ExamplePaneOptions = {}
): Pane {
  const { title = kDefaultTitle } = options;

  const dockElement = document.querySelector<HTMLElementTagNameMap["jolly-dock"]>(
    "#tools"
  );
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
      value !== current && window.location.assign(value);
    });

  const preferences = document.createElement("jolly-theme-preferences");
  // Two rows at the top of the pane rather than flattened into it, see
  // @jolly-pixel/ui docs/api/theme/theme-preferences.md.
  preferences.layout = "stack";
  preferences.storageKey = "three-examples";
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

// `/index.html` and `/` are the same page.
function currentExample(): string {
  const { pathname } = window.location;

  return pathname === "/index.html" ? "/" : pathname;
}
