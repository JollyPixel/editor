// Import Third-party Dependencies
import {
  Checkbox,
  Dialog,
  detailOf,
  type JollyChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { actionButton, settlePrompt } from "./dialogPromptHelpers.ts";
import type { MirrorAxes } from "../../../features/groups/mirrorTransform.ts";

export interface DuplicateResult {
  includeChildren: boolean;
  mirrorAxes: MirrorAxes;
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

  const mirrorAxes: MirrorAxes = { x: false, y: false, z: false };
  const mirrorTitle = document.createElement("div");
  mirrorTitle.textContent = "Mirror axis";
  mirrorTitle.style.fontSize = "0.85em";
  mirrorTitle.style.color = "var(--jolly-text-muted)";
  dialog.append(mirrorTitle);

  const mirrorRow = document.createElement("div");
  mirrorRow.style.display = "flex";
  mirrorRow.style.gap = "var(--jolly-space-4, 16px)";
  dialog.append(mirrorRow);

  mirrorRow.append(
    createMirrorAxisField("X", "x", mirrorAxes),
    createMirrorAxisField("Y", "y", mirrorAxes),
    createMirrorAxisField("Z", "z", mirrorAxes)
  );

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

    return {
      includeChildren: hasChildren && includeChildren,
      mirrorAxes
    };
  }
}

function createMirrorAxisField(
  label: string,
  axis: keyof MirrorAxes,
  mirrorAxes: MirrorAxes
): Checkbox {
  const field = new Checkbox();
  field.label = label;
  field.value = false;
  field.addEventListener("jolly-change", (event: Event) => {
    const detail = detailOf<JollyChangeDetail<boolean>>(event);
    if (detail !== null) {
      mirrorAxes[axis] = detail.value;
    }
  });

  return field;
}
