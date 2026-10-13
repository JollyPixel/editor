// Import Third-party Dependencies
import { showChoice } from "@jolly-pixel/ui";
import type {
  ImportConflictPolicy,
  ImportPlan
} from "@jolly-pixel/asset-server/client";

/**
 * Asks how to import an archive whose assets partly exist already. Resolves
 * with `null` when the dialog is dismissed.
 */
export function askImportConflictPolicy(
  plan: ImportPlan
): Promise<ImportConflictPolicy | null> {
  const content: Node[] = [];
  const incompatible = plan.incompatible.length > 0;
  if (plan.sharedDependents.length > 0) {
    const warning = document.createElement("p");
    warning.textContent = "Replacing also changes assets outside the archive:";

    const list = document.createElement("ul");
    for (const shared of plan.sharedDependents) {
      const item = document.createElement("li");
      const dependents = shared.dependents
        .map((dependent) => dependent.path)
        .join(", ");
      item.textContent = `${shared.path} is used by ${dependents}`;
      list.append(item);
    }
    content.push(warning, list);
  }
  if (incompatible) {
    const warning = document.createElement("p");
    warning.textContent = "Some existing IDs have a different asset kind. " +
      "Import those assets as a copy.";
    content.push(warning);
  }

  return showChoice<ImportConflictPolicy>({
    title: "Import archive",
    message: `${plan.live.length} of the archived assets already exist in ` +
      "this workspace.",
    content,
    actions: incompatible ? [
      {
        value: "copy",
        label: "Import as copy"
      }
    ] : [
      {
        value: "keep",
        label: "Keep mine"
      },
      {
        value: "replace",
        label: "Replace",
        variant: "danger"
      },
      {
        value: "copy",
        label: "Import as copy"
      }
    ],
    focus: incompatible ? "copy" : "keep"
  });
}
