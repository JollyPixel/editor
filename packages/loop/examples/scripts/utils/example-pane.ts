// Import Third-party Dependencies
import {
  DockFacade,
  Pane
} from "@jolly-pixel/ui";

// CONSTANTS
const kDefaultTitle = "loop";
const kToggleKey = "F3";
const kExamples: Record<string, string> = {
  Inspector: "/",
  "Lag injector": "/lag.html",
  Interpolation: "/interpolation.html"
};

export interface ExamplePaneOptions {
  /**
   * @default "loop"
   */
  title?: string;
}

/**
 * Adds navigation controls and a page pane to `#tools`. `F3` toggles the dock.
 */
export function createExamplePane(
  options: ExamplePaneOptions = {}
): Pane {
  const { title = kDefaultTitle } = options;

  const dockElement = document.querySelector<
    HTMLElementTagNameMap["jolly-dock"]
  >("#tools");
  if (dockElement === null) {
    throw new Error("createExamplePane: no #tools jolly-dock in this page");
  }
  const dock = DockFacade.from(dockElement);

  const chrome = new Pane({
    title: "Examples",
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
  // Keep preferences stacked. See the UI theme-preferences API docs.
  preferences.layout = "stack";
  preferences.storageKey = "loop-examples";
  chrome.element.append(preferences);

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
 * Normalizes `/index.html` to the switcher's `/` route.
 */
function currentExample(): string {
  const { pathname } = window.location;

  return pathname === "/index.html" ? "/" : pathname;
}
