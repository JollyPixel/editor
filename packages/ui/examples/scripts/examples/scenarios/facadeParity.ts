// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { Pane } from "../../../../src/index.ts";

export const FACADE_PARITY_EXAMPLE: GalleryExample = {
  id: "scenarios/facade-parity",
  title: "Facade parity",
  render(host) {
    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent = "Built through the Pane facade. Look for it floating near the top left.";
    host.append(hint);

    const state = {
      enabled: true,
      speed: 1.5,
      mode: "orbit",
      fps: 60
    };

    const pane = new Pane({ title: "facade-parity" });
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

    return () => pane.dispose();
  }
};
