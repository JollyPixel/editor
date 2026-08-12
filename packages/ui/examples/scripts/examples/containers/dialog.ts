// Import Internal Dependencies
import {
  showConfirm,
  showPrompt
} from "../../../../src/index.ts";
import type { GalleryExample } from "../../types.ts";
import {
  button,
  text
} from "../shared/containerBuilders.ts";

export const DIALOG_EXAMPLE: GalleryExample = {
  id: "containers/dialog",
  title: "Dialog",
  group: "Containers",
  render(host) {
    const root = document.createElement("div");
    root.className = "chrome-row";
    const open = button("Open dialog", "accent");
    const dialog = document.createElement("jolly-dialog");
    dialog.heading = "Delete layer?";
    dialog.append(text("This declarative dialog can contain arbitrary content."));
    const close = button("Close", "accent");
    close.slot = "actions";
    close.addEventListener("click", () => dialog.close());
    dialog.append(close);
    open.addEventListener("click", () => void dialog.showModal());
    const confirm = button("Show confirm helper");
    confirm.dataset.action = "confirm-helper";
    confirm.addEventListener("click", async() => {
      root.dataset.result = String(await showConfirm({
        title: "Confirm helper",
        message: "Continue?"
      }));
    });
    const prompt = button("Show prompt helper");
    prompt.dataset.action = "prompt-helper";
    prompt.addEventListener("click", async() => {
      root.dataset.result = String(await showPrompt({
        title: "Prompt helper",
        label: "Name"
      }));
    });
    root.append(open, confirm, prompt, dialog);
    host.append(root);

    return () => root.remove();
  }
};
