// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";

export const FOLDER_EXAMPLE = createSimpleExample(
  "containers/folder",
  "Folder",
  "Containers",
  () => {
    const folder = document.createElement("jolly-folder");
    folder.label = "Transform";
    folder.append(
      action("plus", "Add channel"),
      action("close", "Clear channels")
    );
    const content = document.createElement("p");
    content.textContent = "Position, rotation, and scale controls belong here.";
    folder.append(content);

    return folder;
  }
);

function action(
  icon: string,
  label: string
): HTMLElementTagNameMap["jolly-button"] {
  const button = document.createElement("jolly-button");
  button.slot = "actions";
  button.icon = icon;
  button.iconOnly = true;
  button.label = label;
  button.title = label;
  button.dataset.action = icon;
  button.addEventListener("click", () => {
    button.dataset.clicks = String(Number(button.dataset.clicks ?? "0") + 1);
  });

  return button;
}
