// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { text } from "../shared/containerBuilders.ts";

// CONSTANTS
const kStorageKey = "gallery-example:dock-layout-transparent";

/**
 * A single overlay dock docked to the right of a full-bleed viewport, the
 * arrangement `@jolly-pixel/three`'s examples use for their real-time
 * chrome: the dock floats over the scene rather than pushing it aside, and
 * the gaps around its panes let pointer events reach the content underneath.
 *
 * The top pane also carries a raw `jolly-theme-preferences`, the same
 * placement `three`'s `example-switcher.ts` uses and the shape that
 * regresses if the control ever measures as zero-sized again.
 */
export const DOCK_LAYOUT_TRANSPARENT_EXAMPLE: GalleryExample = {
  id: "scenarios/dock-layout-transparent",
  title: "Dock layout transparent",
  group: "Scenarios",
  render(host) {
    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent = "The dock floats over the viewport; drag its separator or its panes " +
      "and the checkered backdrop keeps showing through.";

    const stage = document.createElement("div");
    stage.className = "dock-transparent-stage";

    const layout = document.createElement("jolly-dock-layout");
    layout.storageKey = kStorageKey;

    const viewport = document.createElement("div");
    viewport.className = "dock-transparent-viewport";
    viewport.append(text("Scene / viewport content"));

    const tools = document.createElement("jolly-dock");
    tools.side = "right";
    tools.align = "start";
    tools.overlay = true;
    tools.collapsible = true;
    tools.key = "tools";
    tools.size = 280;

    const chrome = document.createElement("jolly-pane");
    chrome.key = "chrome";
    chrome.heading = "Configuration";
    chrome.locked = true;
    const preferences = document.createElement("jolly-theme-preferences");
    preferences.storageKey = "gallery-dock-layout-transparent";
    chrome.append(preferences);

    const inspector = document.createElement("jolly-pane");
    inspector.key = "inspector";
    inspector.heading = "Inspector";
    inspector.collapsible = true;
    inspector.append(text("Grows to fill the rest of the dock."));

    tools.append(chrome, inspector);
    layout.append(viewport, tools);
    stage.append(layout);
    host.append(hint, stage);

    return () => stage.remove();
  }
};
