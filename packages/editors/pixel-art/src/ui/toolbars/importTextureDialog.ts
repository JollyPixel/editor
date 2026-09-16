// Import Third-party Dependencies
import {
  Button,
  Dialog,
  detailOf,
  type ButtonVariant
} from "@jolly-pixel/ui";

export type ImportTextureChoice = "replace" | "add";

export interface ImportTextureDialogOptions {
  name: string;
}

export function showImportTextureDialog(
  options: ImportTextureDialogOptions
): Promise<ImportTextureChoice | null> {
  const dialog = new Dialog();
  dialog.heading = "Import texture";

  const message = document.createElement("p");
  message.textContent = `Replace the current texture with "${options.name}", ` +
    "or add it as a new texture?";
  dialog.append(message);

  const add = actionButton("Add as new", "add", "accent");
  const replace = actionButton("Replace current", "replace", "default");
  const cancel = actionButton("Cancel", "cancel", "default");
  for (const button of [cancel, replace, add]) {
    button.addEventListener("click", () => dialog.close(button.dataset.action ?? ""));
  }
  dialog.append(cancel, replace, add);
  document.body.append(dialog);

  const { promise, resolve } = Promise.withResolvers<ImportTextureChoice | null>();
  let settled = false;

  function settle(
    returnValue: string
  ): void {
    if (settled) {
      return;
    }

    settled = true;
    dialog.remove();
    resolve(
      returnValue === "replace" || returnValue === "add" ? returnValue : null
    );
  }

  dialog.addEventListener("jolly-cancel", () => settle(""));
  dialog.addEventListener("jolly-close", (event) => {
    const detail = detailOf<{ returnValue: string; }>(event);
    if (detail !== null) {
      settle(detail.returnValue);
    }
  });
  void dialog.showModal().then(() => add.focus());

  return promise;
}

function actionButton(
  label: string,
  action: string,
  variant: ButtonVariant
): Button {
  const button = new Button();
  button.slot = "actions";
  button.variant = variant;
  button.dataset.action = action;
  button.textContent = label;

  return button;
}
