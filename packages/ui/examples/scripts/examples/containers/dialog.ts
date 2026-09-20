// Import Internal Dependencies
import {
  DIALOG_INTENTS,
  detailOf,
  showChoice,
  showConfirm,
  showPrompt,
  type JollyChangeDetail,
  type JollyHeadingChangeDetail
} from "../../../../src/index.ts";
import type { GalleryExample } from "../../types.ts";
import {
  button,
  text
} from "../shared/containerBuilders.ts";

function intentButtons(
  root: HTMLElement
): HTMLElement[] {
  return DIALOG_INTENTS.map((intent) => {
    const trigger = button(`Show ${intent} confirm`);
    trigger.dataset.action = `intent-${intent}`;
    trigger.addEventListener("click", async() => {
      root.dataset.result = String(await showConfirm({
        title: `A dialog with the ${intent} intent`,
        message: "The header states the intent; the actions keep their own.",
        intent
      }));
    });

    return trigger;
  });
}

function tonedDialog(): HTMLElement[] {
  const dialog = document.createElement("jolly-dialog");
  dialog.id = "toned-dialog";
  dialog.heading = "Visibility";
  dialog.icon = "eye";
  dialog.tone = "teal";
  dialog.append(text("A toned dialog is an area: its accent follows the hue."));
  const close = button("Close", "accent");
  close.slot = "actions";
  close.addEventListener("click", () => dialog.close());
  dialog.append(close);
  const trigger = button("Open toned dialog");
  trigger.dataset.action = "toned-dialog";
  trigger.addEventListener("click", () => void dialog.showModal());

  return [trigger, dialog];
}

function inlineConfirmDialog(
  root: HTMLElement
): HTMLElement[] {
  const dialog = document.createElement("jolly-dialog");
  dialog.id = "inline-confirm-dialog";
  dialog.heading = "Tileset \"Terrain\"";
  dialog.icon = "sliders";
  dialog.append(text("Used by 3 blocks, 120 voxels in the map."));
  const remove = button("Remove", "danger");
  remove.slot = "actions";
  remove.dataset.action = "inline-remove";
  remove.addEventListener("click", async() => {
    const confirmed = await dialog.confirmInline({
      message: "3 blocks use this tileset and will lose their texture.",
      confirmLabel: "Remove",
      danger: true
    });
    root.dataset.result = `inline:${String(confirmed)}`;
    if (confirmed) {
      dialog.close();
    }
  });
  const close = button("Close", "accent");
  close.slot = "actions";
  close.addEventListener("click", () => dialog.close());
  dialog.append(remove, close);
  const trigger = button("Open inline confirm dialog");
  trigger.dataset.action = "inline-confirm";
  trigger.addEventListener("click", () => void dialog.showModal());

  return [trigger, dialog];
}

export const DIALOG_EXAMPLE: GalleryExample = {
  id: "containers/dialog",
  title: "Dialog",
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
    const choice = button("Show choice helper");
    choice.dataset.action = "choice-helper";
    choice.addEventListener("click", async() => {
      root.dataset.result = String(await showChoice({
        title: "Choice helper",
        message: "Replace the texture or add a new one?",
        actions: [
          {
            value: "replace",
            label: "Replace"
          },
          {
            value: "add",
            label: "Add",
            variant: "accent"
          }
        ],
        focus: "add"
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

    const editableHeading = document.createElement("jolly-dialog");
    editableHeading.id = "title-dialog";
    editableHeading.heading = "Lantern";
    editableHeading.headingEditable = true;
    editableHeading.append(text("The heading itself carries the name."));
    editableHeading.addEventListener("jolly-heading-change", (event) => {
      const detail = detailOf<JollyHeadingChangeDetail>(event);
      if (detail !== null) {
        editableHeading.heading = detail.heading;
        root.dataset.result = `heading:${detail.heading}`;
      }
    });
    const closeHeading = button("Close", "accent");
    closeHeading.slot = "actions";
    closeHeading.addEventListener("click", () => editableHeading.close());
    editableHeading.append(closeHeading);
    const openHeading = button("Open titled dialog");
    openHeading.dataset.action = "editable-heading";
    openHeading.addEventListener(
      "click",
      () => void editableHeading.showModal()
    );

    root.append(
      open,
      confirm,
      prompt,
      choice,
      openDefault,
      openHeading,
      ...intentButtons(root),
      ...tonedDialog(),
      ...inlineConfirmDialog(root),
      dialog,
      defaultAction,
      editableHeading
    );
    host.append(root);
  }
};
