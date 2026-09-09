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
const kLayoutStorageKey = "three-examples:layout";
const kToolsSize = 340;

export interface ExamplePaneOptions {
  title?: string;
}

export function createExamplePane(
  options: ExamplePaneOptions = {}
): Pane {
  const { title = kDefaultTitle } = options;

  const dock = DockFacade.from(toolsDock());

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

function toolsDock(): HTMLElementTagNameMap["jolly-dock"] {
  const existing = document.querySelector<HTMLElementTagNameMap["jolly-dock"]>(
    "#tools"
  );
  if (existing !== null) {
    return existing;
  }

  const dock = document.createElement("jolly-dock");
  dock.id = "tools";
  dock.key = "tools";
  dock.side = "right";
  dock.align = "start";
  dock.overlay = true;
  dock.collapsible = true;
  dock.size = kToolsSize;
  dockLayout().append(dock);

  return dock;
}

function dockLayout(): HTMLElementTagNameMap["jolly-dock-layout"] {
  const existing = document.querySelector("jolly-dock-layout");
  if (existing !== null) {
    return existing;
  }

  const scope = document.querySelector("jolly-scope");
  if (scope === null) {
    throw new Error("createExamplePane: no jolly-scope in this page's HTML");
  }

  const layout = document.createElement("jolly-dock-layout");
  layout.storageKey = kLayoutStorageKey;
  scope.append(layout);

  return layout;
}

function currentExample(): string {
  const { pathname } = window.location;

  return pathname.replace(/index\.html$/, "");
}
