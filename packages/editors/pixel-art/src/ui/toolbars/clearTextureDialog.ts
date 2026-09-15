// Import Third-party Dependencies
import {
  Button,
  Checkbox,
  Dialog,
  detailOf,
  onFieldChange,
  type ButtonVariant
} from "@jolly-pixel/ui";

// CONSTANTS
const kMessage = "Make the texture transparent? " +
  "Pixels inside UV slots are kept unless the option below is checked.";
const kNoRegionsMessage = "Clear the entire texture and make every pixel transparent?";

export interface ClearTextureDialogOptions {
  hasUVRegions: boolean;
}

export interface ClearTextureDialogResult {
  includeUV: boolean;
}

export function showClearTextureDialog(
  options: ClearTextureDialogOptions
): Promise<ClearTextureDialogResult | null> {
  const dialog = new Dialog();
  dialog.heading = "Clear texture";

  const message = document.createElement("p");
  message.textContent = options.hasUVRegions ? kMessage : kNoRegionsMessage;
  dialog.append(message);

  let includeUV = false;
  if (options.hasUVRegions) {
    const checkbox = new Checkbox();
    checkbox.label = "Also clear pixels inside UV slots";
    checkbox.value = false;
    onFieldChange<boolean>(checkbox, (value) => {
      includeUV = value;
    });
    dialog.append(checkbox);
  }

  const confirm = actionButton("Clear", "confirm", "danger");
  const cancel = actionButton("Cancel", "cancel", "default");
  confirm.addEventListener("click", () => dialog.close("confirm"));
  cancel.addEventListener("click", () => dialog.close("cancel"));
  dialog.append(cancel, confirm);
  document.body.append(dialog);

  const { promise, resolve } = Promise.withResolvers<ClearTextureDialogResult | null>();
  let settled = false;

  function settle(
    returnValue: string
  ): void {
    if (settled) {
      return;
    }

    settled = true;
    dialog.remove();
    resolve(returnValue === "confirm" ? { includeUV } : null);
  }

  dialog.addEventListener("jolly-cancel", () => settle(""));
  dialog.addEventListener("jolly-close", (event) => {
    const detail = detailOf<{ returnValue: string; }>(event);
    if (detail !== null) {
      settle(detail.returnValue);
    }
  });
  void dialog.showModal().then(() => confirm.focus());

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
