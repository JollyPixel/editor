// Import Internal Dependencies
import "../containers/dock/Dock.ts";
import "../containers/dock/DockLayout.ts";
import { DockFacade } from "./Dock.ts";
import { Pane } from "./Pane.ts";

// CONSTANTS
const kToolsDockId = "tools";
const kToolsSize = 340;
const kToggleKey = "F3";

export interface ExamplePaneOptions {
  title: string;
  examples: Record<string, string>;
  storageKey: string;
}

export function createExamplePane(
  options: ExamplePaneOptions
): Pane {
  const {
    title,
    examples,
    storageKey
  } = options;

  const dock = DockFacade.from(toolsDock(storageKey));
  const chrome = new Pane({
    title: "Examples",
    container: dock.element,
    grow: false,
    locked: true
  });
  const current = currentExample();

  chrome
    .addBinding({ example: current }, "example", {
      options: examples,
      label: "Current"
    })
    .on("change", ({ value }) => {
      if (value !== current) {
        window.location.assign(value);
      }
    });
  chrome.addThemePreferences({ storageKey });

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

function toolsDock(
  storageKey: string
): HTMLElementTagNameMap["jolly-dock"] {
  const existing = document.querySelector<HTMLElementTagNameMap["jolly-dock"]>(
    `#${kToolsDockId}`
  );
  if (existing !== null) {
    return existing;
  }

  const dock = document.createElement("jolly-dock");
  dock.id = kToolsDockId;
  dock.key = kToolsDockId;
  dock.side = "right";
  dock.align = "start";
  dock.overlay = true;
  dock.collapsible = true;
  dock.size = kToolsSize;
  dockLayout(storageKey).append(dock);

  return dock;
}

function dockLayout(
  storageKey: string
): HTMLElementTagNameMap["jolly-dock-layout"] {
  const existing = document.querySelector("jolly-dock-layout");
  if (existing !== null) {
    return existing;
  }

  const scope = document.querySelector("jolly-scope");
  if (scope === null) {
    throw new Error("createExamplePane: no jolly-scope in this page's HTML");
  }

  const layout = document.createElement("jolly-dock-layout");
  layout.storageKey = `${storageKey}:layout`;
  scope.append(layout);

  return layout;
}

function currentExample(): string {
  return window.location.pathname.replace(/index\.html$/, "");
}
