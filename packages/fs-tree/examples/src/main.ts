/* eslint-disable no-alert */
// Import Internal Dependencies
import { TreeView } from "../../src/index.ts";

const container = document.querySelector("main") as HTMLDivElement;

const treeView = new TreeView(
  container,
  {
    dragStartCallback(event, node) {
      event.dataTransfer?.setData("text/plain", node.textContent);

      return true;
    },
    dropCallback(event, dropLocation) {
      console.log(
        event.dataTransfer?.getData("text/plain") +
        " was dropped " +
        dropLocation.where +
        " " +
        dropLocation.target.textContent
      );

      return true;
    }
  }
);

function createItem(
  label: string
): HTMLLIElement {
  const itemElt = document.createElement("li");

  const iconElt = document.createElement("i");
  iconElt.classList.add("icon");
  itemElt.appendChild(iconElt);

  const spanElt = document.createElement("span");
  spanElt.textContent = label;
  itemElt.appendChild(spanElt);

  return itemElt;
}

function createGroup(
  label: string
): HTMLLIElement {
  const groupElt = document.createElement("li");

  const spanElt = document.createElement("span");
  spanElt.textContent = label;
  groupElt.appendChild(spanElt);

  return groupElt;
}

for (let i = 0; i < 10; i++) {
  const group = createGroup("Group " + (i + 1));
  treeView.append(group, "group");

  for (let j = 0; j < 5; j++) {
    const item = createItem("Item " + (i * 3 + j + 1));
    treeView.append(item, "item", group);
  }
}

treeView.append(
  createGroup("Empty Group 1"),
  "group",
  document.querySelector(".group")!
);

treeView.append(
  createGroup("Empty Group 2"),
  "group",
  document.querySelector(".group:last-child")!
);

treeView.addEventListener("selectionChange", function change() {
  let text;
  if (treeView.selector.nodes.length > 1) {
    const len = treeView.selector.nodes.length;

    text = "" + String(len) + " items selected";
  }
  else if (treeView.selector.nodes.length === 1) {
    text = "1 item selected";
  }
  else {
    text = "No items selected";
  }

  console.log(text);
});

treeView.addEventListener("activate", function activate() {
  alert("Activated " + treeView.selector.nodes[0].querySelector("span")?.textContent);
});
