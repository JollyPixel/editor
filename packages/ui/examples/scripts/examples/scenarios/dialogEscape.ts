// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import {
  button,
  text
} from "../shared/containerBuilders.ts";

export const DIALOG_ESCAPE_EXAMPLE = createSimpleExample(
  "scenarios/dialog-escape",
  "Dialog Escape",
  "Scenarios",
  () => {
    const root = document.createElement("div");
    root.className = "chrome-row";
    const dialog = document.createElement("jolly-dialog");
    dialog.title = "Press Escape";
    dialog.append(text("Escape follows the native dialog cancellation path."));
    const open = button("Open dismissible dialog");
    open.addEventListener("click", () => void dialog.showModal());
    root.append(open, dialog);

    return root;
  }
);
