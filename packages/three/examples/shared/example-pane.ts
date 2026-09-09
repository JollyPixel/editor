// Import Third-party Dependencies
import {
  DockFacade,
  Pane
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { exampleOptions } from "./manifest.ts";

// CONSTANTS
const kDefaultTitle = "three";
const kToggleKey = "F3";

export interface ExamplePaneOptions {
  title?: string;
}

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
      options: exampleOptions(),
      label: "Current"
    })
    .on("change", ({ value }) => {
      value !== current && window.location.assign(value);
    });

  const preferences = document.createElement("jolly-theme-preferences");
  preferences.layout = "stack";
  preferences.storageKey = "three-examples";
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

function currentExample(): string {
  const { pathname } = window.location;

  return pathname.replace(/index\.html$/, "");
}
