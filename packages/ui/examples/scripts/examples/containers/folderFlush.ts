// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";

export const FOLDER_FLUSH_EXAMPLE = createSimpleExample(
  "containers/folder-flush",
  "Folder (flush)",
  "Containers",
  () => {
    const host = document.createElement("div");
    host.append(
      folder("indented", "Indented"),
      folder("flush", "Flush")
    );

    return host;
  }
);

function folder(
  id: string,
  label: string
): HTMLElementTagNameMap["jolly-folder"] {
  const outer = document.createElement("jolly-folder");
  outer.label = label;
  outer.dataset.folder = id;
  outer.flush = id === "flush";

  const inner = document.createElement("jolly-folder");
  inner.label = `${label} child`;
  inner.dataset.folder = `${id}-child`;
  inner.flush = outer.flush;

  const row = document.createElement("p");
  row.dataset.row = id;
  row.textContent = "A nested row lines up with the folder above it.";
  inner.append(row);
  outer.append(inner);

  return outer;
}
