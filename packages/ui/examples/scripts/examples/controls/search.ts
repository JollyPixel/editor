// Import Internal Dependencies
import "../../../../src/containers/folder/Folder.ts";
import "../../../../src/containers/pane/Pane.ts";
import "../../../../src/controls/Search.ts";
import "../../../../src/controls/Text.ts";
import "../../../../src/controls/Checkbox.ts";
import "../../../../src/data/tree/Tree.ts";
import { onFieldChange } from "../../../../src/field/events.ts";
import type { TreeNode } from "../../../../src/data/tree/contract.ts";
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kScene: TreeNode[] = [
  {
    id: "scene",
    label: "Scene",
    children: [
      {
        id: "props",
        label: "Props",
        children: [
          { id: "crate", label: "Crate" },
          { id: "barrel", label: "Barrel" },
          { id: "lamp", label: "Street lamp" }
        ]
      },
      {
        id: "lights",
        label: "Lights",
        children: [
          { id: "sun", label: "Sun" },
          { id: "lamp-light", label: "Lamp light" }
        ]
      },
      { id: "camera", label: "Main camera" }
    ]
  }
];

export const SEARCH_EXAMPLE: GalleryExample = {
  render(host) {
    const layout = document.createElement("div");
    layout.style.cssText = [
      "display: grid",
      "gap: 12px",
      "grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))"
    ].join("; ");
    layout.append(
      standalone(),
      scenePane(),
      inspectorPane()
    );
    host.append(layout);
  }
};

function standalone(): HTMLElement {
  const column = document.createElement("div");
  column.style.cssText = "display: flex; flex-direction: column; gap: 8px;";

  const search = document.createElement("jolly-search");
  search.dataset.search = "standalone";
  search.placeholder = "Search assets";

  const compact = document.createElement("jolly-search");
  compact.dataset.search = "compact";
  compact.compact = true;

  const echo = document.createElement("output");
  echo.dataset.echo = "";
  onFieldChange<string>(search, (value) => {
    echo.textContent = value;
  }, "jolly-input");

  column.append(search, compact, echo);

  return column;
}

function scenePane(): HTMLElement {
  const pane = document.createElement("jolly-pane");
  pane.heading = "Scene";
  pane.searchable = true;
  pane.dataset.pane = "scene";
  pane.style.height = "220px";

  const tree = document.createElement("jolly-tree");
  tree.nodes = kScene;
  tree.expanded = ["scene"];
  tree.indentGuides = true;
  tree.reorderable = true;
  tree.addEventListener("jolly-toggle-expand", (event) => {
    const { id, expanded } = event.detail;
    tree.expanded = expanded ?
      [...tree.expanded, id] :
      tree.expanded.filter((expandedId) => expandedId !== id);
  });
  tree.addEventListener("jolly-select", (event) => {
    tree.selected = event.detail.selected;
  });
  pane.append(tree);

  return pane;
}

function inspectorPane(): HTMLElement {
  const pane = document.createElement("jolly-pane");
  pane.heading = "Inspector";
  pane.searchable = true;
  pane.dataset.pane = "inspector";

  pane.append(
    folder("Transform", ["Position", "Rotation", "Scale"]),
    folder("Rendering", ["Material", "Cast shadows"])
  );

  return pane;
}

function folder(
  label: string,
  fields: string[]
): HTMLElement {
  const element = document.createElement("jolly-folder");
  element.label = label;
  element.dataset.folder = label;
  for (const name of fields) {
    const field = document.createElement("jolly-text");
    field.label = name;
    field.dataset.field = name;
    field.value = "";
    element.append(field);
  }

  return element;
}
