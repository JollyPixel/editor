// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  Control,
  Controls
} from "../../../../src/index.ts";

export const CONTROLS_EXAMPLE: GalleryExample = {
  id: "controls/scene-controls",
  title: "Scene controls",
  group: "Controls",
  render(host) {
    const scene = document.createElement("div");
    const controls = new Controls();
    controls.heading = "Controls";
    controls.maxEntriesPerRow = 3;
    controls.position = "bottom-left";
    scene.className = "scene";
    scene.style.position = "relative";
    scene.style.minHeight = "20rem";

    scene.append(controls);
    controls.append(
      createControl(
        "Move forward",
        "Moves the player relative to the camera direction.",
        "W"
      ),
      createControl("Move left", "Moves the player left.", "A"),
      createControl("Move backward", "Moves away from the camera.", "S"),
      createControl("Move right", "Moves the player right.", "D"),
      createControl("Sprint", "Hold while moving.", "Shift", "W")
    );
    host.append(scene);
  }
};

function createControl(
  description: string,
  details: string,
  ...keys: string[]
): Control {
  const control = new Control();
  control.description = description;
  control.details = details;

  for (const key of keys) {
    const element = document.createElement("kbd");
    element.textContent = key;
    control.append(element);
  }

  return control;
}
