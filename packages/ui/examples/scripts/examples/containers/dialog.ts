// Import Internal Dependencies
import {
  detailOf,
  showConfirm,
  showPrompt,
  type JollyChangeDetail
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
    dialog.id = "delete-dialog";
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
    const defaultAction = document.createElement("jolly-dialog");
    defaultAction.id = "rename-dialog";
    defaultAction.heading = "Rename layer";
    const field = document.createElement("jolly-text");
    field.label = "Name";
    field.addEventListener("jolly-change", (event) => {
      const detail = detailOf<JollyChangeDetail<string>>(event);
      if (detail !== null) {
        field.value = detail.value;
      }
    });
    const cancel = button("Cancel");
    cancel.slot = "actions";
    cancel.addEventListener("click", () => defaultAction.close());
    const rename = button("Rename", "accent");
    rename.slot = "actions";
    rename.dataset.default = "";
    rename.addEventListener("click", () => {
      root.dataset.result = `renamed:${String(field.value)}`;
      defaultAction.close();
    });
    defaultAction.append(field, cancel, rename);
    const openDefault = button("Open rename dialog");
    openDefault.dataset.action = "default-action";
    openDefault.addEventListener("click", () => void defaultAction.showModal());

    root.append(open, confirm, prompt, openDefault, dialog, defaultAction);
    host.append(root);

    return () => root.remove();
  }
};
