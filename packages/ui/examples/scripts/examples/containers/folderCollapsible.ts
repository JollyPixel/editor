// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";

export const FOLDER_COLLAPSIBLE_EXAMPLE = createSimpleExample(
  "containers/folder-collapsible",
  "Folder (collapsible)",
  "Containers",
  () => {
    const host = document.createElement("div");
    host.append(
      folder("collapsible", "Collapsible", true),
      folder("pinned", "Always open", false)
    );

    return host;
  }
);

function folder(
  id: string,
  label: string,
  collapsible: boolean
): HTMLElementTagNameMap["jolly-folder"] {
  const element = document.createElement("jolly-folder");
  element.label = label;
  element.collapsible = collapsible;
  element.dataset.folder = id;

  const action = document.createElement("jolly-button");
  action.slot = "actions";
  action.icon = "plus";
  action.iconOnly = true;
  action.label = `Add to ${label}`;
  action.dataset.action = id;

  const row = document.createElement("p");
  row.dataset.row = id;
  row.textContent = "This folder owns the surface below its header.";

  element.append(action, row);

  return element;
}
