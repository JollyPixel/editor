// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import {
  button,
  text
} from "../shared/containerBuilders.ts";
import {
  Color,
  inputLayers
} from "../../../../src/index.ts";

export const DIALOG_ESCAPE_EXAMPLE = createSimpleExample(
  "scenarios/dialog-escape",
  "Dialog Escape",
  () => {
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
      if (!root.isConnected) {
        document.removeEventListener("keydown", recordViewportKey);

        return;
      }
      if (inputLayers.blocks(event)) {
        return;
      }

      root.dataset.viewportKeys = [
        root.dataset.viewportKeys,
        event.code
      ].filter(Boolean).join(",");
    }
    document.addEventListener("keydown", recordViewportKey);

    return root;
  }
);
