// Import Internal Dependencies
import type { ContextMenuEntry } from "../../../../src/index.ts";
import { createSimpleExample } from "../shared/example.ts";
import { text } from "../shared/containerBuilders.ts";

// CONSTANTS
const kRows = ["Torso", "Arm", "Locked leg"];

function entriesFor(
  row: string
): ContextMenuEntry[] {
  const locked = row.startsWith("Locked");

  return [
    {
      id: "rename",
      label: "Rename",
      disabled: locked
    },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: "plus"
    },
    {
      id: "add",
      label: "Add",
      disabled: locked,
      items: [
        {
          id: "add-bone",
          label: "Bone"
        },
        {
          id: "add-light",
          label: "Light"
        },
        {
          id: "add-shape",
          label: "Shape",
          items: [
            {
              id: "add-cube",
              label: "Cube"
            },
            {
              id: "add-sphere",
              label: "Sphere"
            }
          ]
        }
      ]
    },
    "separator",
    {
      id: "delete",
      label: "Delete",
      icon: "close",
      intent: "danger",
      disabled: locked
    }
  ];
}

export const CONTEXT_MENU_EXAMPLE = createSimpleExample(
  "containers/context-menu",
  "Context menu",
  () => {
    const root = document.createElement("div");
    const menu = document.createElement("jolly-context-menu");
    menu.label = "Row actions";
    let target = "";

    const rows = kRows.map((name) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "row";
      row.textContent = name;
      row.style.display = "block";
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        row.focus();
        target = name;
        menu.items = entriesFor(name);
        menu.openAt(event.clientX, event.clientY);
      });

      return row;
    });
    menu.addEventListener("jolly-context-action", (event) => {
      root.dataset.result = `${event.detail.id}:${target}`;
    });

    root.append(
      text("Right-click a row, or focus it and press Shift+F10."),
      ...rows,
      menu
    );

    return root;
  }
);
