// Import Third-party Dependencies
import {
  Checkbox,
  Dialog,
  detailOf,
  type JollyChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { actionButton, settlePrompt } from "./dialogPromptHelpers.ts";

export interface DuplicateResult {
  includeChildren: boolean;
}

export interface PromptDuplicateOptions {
  hasChildren: boolean;
}

export function promptDuplicate(
  { hasChildren }: PromptDuplicateOptions
): Promise<DuplicateResult | null> {
  const dialog = new Dialog();
  dialog.heading = "Duplicate";

  let includeChildren = true;
  if (hasChildren) {
    const includeChildrenField = new Checkbox();
    includeChildrenField.label = "Duplicate children too";
    includeChildrenField.value = true;
    includeChildrenField.addEventListener("jolly-change", captureIncludeChildren);
    dialog.append(includeChildrenField);
  }

  const confirm = actionButton("Duplicate", "confirm", "accent");
  const cancel = actionButton("Cancel", "cancel", "default");
  confirm.addEventListener("click", () => dialog.close("confirm"));
  cancel.addEventListener("click", () => dialog.close("cancel"));
  dialog.append(cancel, confirm);
  document.body.append(dialog);

  return settlePrompt(dialog, resolveResult, confirm);

  function captureIncludeChildren(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<boolean>>(event);
    if (detail !== null) {
      includeChildren = detail.value;
    }
  }

  function resolveResult(
    returnValue: string
  ): DuplicateResult | null {
    if (returnValue !== "confirm") {
      return null;
    }

    return { includeChildren: hasChildren && includeChildren };
  }
}
