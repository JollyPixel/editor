// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { Pane } from "../../../../src/index.ts";

// CONSTANTS
const kStorageKey = "gallery-example:facade";

export const FACADE_EXAMPLE: GalleryExample<"hidden"> = {
  id: "scenarios/facade",
  title: "Facade",
  options: [
    {
      key: "hidden",
      label: "Start hidden"
    }
  ],
  render(host, options) {
    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent = "Built through the Pane facade. Look for it floating near the top left.";

    const state = {
      enabled: true,
      speed: 1.5,
      mode: "orbit",
      fps: 60
    };

    const pane = new Pane({
      title: "facade",
      storageKey: kStorageKey,
      hidden: options.hidden
    });
    const scene = pane.addFolder({ title: "Scene" });
    scene.addBinding(state, "enabled");
    scene.addBinding(state, "speed", { min: 0, max: 5, step: 0.1 });
    scene.addBinding(state, "mode", {
      options: { orbit: "orbit", free: "free", fixed: "fixed" }
    });
    scene.addSeparator();
    scene.addMonitor(state, "fps");
    scene.addButton({ title: "Reset speed" }).on("click", () => {
      state.speed = 1.5;
      pane.refresh();
    });

    const toggle = document.createElement("jolly-button");
    toggle.textContent = "Toggle pane";
    toggle.dataset.action = "toggle-pane";
    toggle.addEventListener("click", () => {
      pane.hidden = !pane.hidden;
    });
    host.append(hint, toggle);

    return () => pane.dispose();
  }
};
