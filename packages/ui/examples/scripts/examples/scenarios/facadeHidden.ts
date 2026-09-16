// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { Pane } from "../../../../src/index.ts";

// CONSTANTS
const kStorageKey = "gallery-example:facade-hidden";

export const FACADE_HIDDEN_EXAMPLE: GalleryExample = {
  id: "scenarios/facade-hidden",
  title: "Facade hidden pane",
  render(host) {
    const pane = new Pane({
      title: "facade-hidden",
      storageKey: kStorageKey,
      hidden: true
    });
    pane.addFolder({ title: "Stats" });

    const toggle = document.createElement("jolly-button");
    toggle.textContent = "Toggle pane";
    toggle.dataset.action = "toggle-pane";
    toggle.addEventListener("click", () => {
      pane.hidden = !pane.hidden;
    });
    host.append(toggle);

    return () => pane.dispose();
  }
};
