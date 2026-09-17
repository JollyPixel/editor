// Import Third-party Dependencies
import {
  Checkbox,
  Dialog,
  detailOf,
  type JollyChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { actionButton, settlePrompt } from "./dialogPromptHelpers.ts";

export interface DeleteResult {
  deleteChildren: boolean;
}

export interface PromptDeleteOptions {
  hasChildren: boolean;
  /** @default "Delete Block" */
  heading?: string;
}

export function promptDelete(
  { hasChildren, heading = "Delete Block" }: PromptDeleteOptions
): Promise<DeleteResult | null> {
  const dialog = new Dialog();
  dialog.heading = heading;

  let deleteChildren = true;
  if (hasChildren) {
    const deleteChildrenField = new Checkbox();
    deleteChildrenField.label = "Delete children too";
    deleteChildrenField.value = true;
    deleteChildrenField.addEventListener("jolly-change", captureDeleteChildren);
    dialog.append(deleteChildrenField);
  }

  const confirm = actionButton("Delete", "confirm", "danger");
  const cancel = actionButton("Cancel", "cancel", "default");
  confirm.addEventListener("click", () => dialog.close("confirm"));
  cancel.addEventListener("click", () => dialog.close("cancel"));
  dialog.append(cancel, confirm);
  document.body.append(dialog);

  return settlePrompt(dialog, resolveResult, cancel);

  function captureDeleteChildren(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<boolean>>(event);
    if (detail !== null) {
      deleteChildren = detail.value;
    }
  }

  function resolveResult(
    returnValue: string
  ): DeleteResult | null {
    if (returnValue !== "confirm") {
      return null;
    }

    return { deleteChildren: hasChildren && deleteChildren };
  }
}
