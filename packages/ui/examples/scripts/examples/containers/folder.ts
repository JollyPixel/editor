// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";

export const FOLDER_EXAMPLE = createSimpleExample(
  "containers/folder",
  "Folder",
  "Containers",
  () => {
    const folder = document.createElement("jolly-folder");
    folder.label = "Transform";
    const content = document.createElement("p");
    content.textContent = "Position, rotation, and scale controls belong here.";
    folder.append(content);

    return folder;
  }
);
