// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  button,
  text
} from "../shared/containerBuilders.ts";
import {
  Color,
  inputLayers
} from "../../../../src/index.ts";

export const DIALOG_ESCAPE_EXAMPLE: GalleryExample = {
  id: "scenarios/dialog-escape",
  title: "Dialog Escape",
  render(host) {
    const root = document.createElement("div");
    root.className = "chrome-row";
    root.dataset.viewportKeys = "";
    const dialog = document.createElement("jolly-dialog");
    dialog.heading = "Press Escape";
    dialog.append(text("Escape follows the native dialog cancellation path."));
    const open = button("Open dismissible dialog");
    open.addEventListener("click", () => void dialog.showModal());
    const color = new Color();
    color.label = "Tint";
    color.value = "#3a86ff";
    root.append(open, color, dialog);

    function recordViewportKey(
      event: KeyboardEvent
    ): void {
      if (inputLayers.blocks(event)) {
        return;
      }

      root.dataset.viewportKeys = [
        root.dataset.viewportKeys,
        event.code
      ].filter(Boolean).join(",");
    }
    document.addEventListener("keydown", recordViewportKey);
    host.append(root);

    return () => document.removeEventListener("keydown", recordViewportKey);
  }
};
