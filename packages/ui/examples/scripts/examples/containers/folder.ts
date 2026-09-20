// Import Internal Dependencies
import type {
  GalleryExample,
  GalleryOptionValues
} from "../../types.ts";

type FolderOptionKey =
  | "collapsible"
  | "flush"
  | "nested";

export const FOLDER_EXAMPLE: GalleryExample<FolderOptionKey> = {
  id: "containers/folder",
  title: "Folder",
  options: [
    {
      key: "collapsible",
      label: "Collapsible",
      initial: true
    },
    {
      key: "flush",
      label: "Flush"
    },
    {
      key: "nested",
      label: "Nested"
    }
  ],
  render(host, options) {
    const folder = buildFolder("Transform", options);
    folder.dataset.folder = "outer";
    folder.append(
      action("plus", "Add channel"),
      action("close", "Clear channels")
    );

    const row = document.createElement("p");
    row.dataset.row = "";
    row.textContent = "Position, rotation, and scale controls belong here.";

    if (options.nested) {
      const inner = buildFolder("Transform child", options);
      inner.dataset.folder = "inner";
      inner.append(row);
      folder.append(inner);
    }
    else {
      folder.append(row);
    }

    host.append(folder);
  }
};

function buildFolder(
  label: string,
  options: GalleryOptionValues<FolderOptionKey>
): HTMLElementTagNameMap["jolly-folder"] {
  const folder = document.createElement("jolly-folder");
  folder.label = label;
  folder.collapsible = options.collapsible;
  folder.flush = options.flush;

  return folder;
}

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
