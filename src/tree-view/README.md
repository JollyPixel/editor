<p align="center"><h1 align="center">
  Tree-View
</h1>

<p align="center">
  A modern fork/re-implementation of <a href="https://github.com/sparklinlabs/dnd-tree-view">dnd-tree-view</a> from Sparklin Labs, rewritten to be fully compatible with the Web Platform using <code>EventTarget</code> and native <code>ES2022</code> features.
</p>

## Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com).

```bash
$ npm i @jolly-pixel/tree-view
# or
$ yarn add @jolly-pixel/tree-view
```

## Usage example

```ts
import { TreeView } from "@jolly-pixel/tree-view";

const container = document.getElementById("tree") as HTMLDivElement;

const tree = new TreeView(container, {
  multipleSelection: true,
  dragStartCallback(event, node) {
    // Optional: cancel drag for some nodes
    console.log("Dragging", node.textContent);

    return true;
  },
  dropCallback(event, location, nodes) {
    // Optional: handle drop and return false to cancel move
    console.log("Dropped", nodes, "at", location);

    return true;
  }
});

const group = document.createElement("li");
group.textContent = "Group A";

const item = document.createElement("li");
item.textContent = "Item A.1";

tree.append(group, "group");
tree.append(item, "item", group);
```

With a minimal CSS

```css
.tree {
  list-style: none;
}

.tree .group > .toggle::before {
  content: "▸";
  display: inline-block;
  margin-right: 5px;
  cursor: pointer;
}

.tree .group.collapsed > .toggle::before {
  content: "▾";
}
```

## API

### constructor(container: HTMLDivElement, options?: TreeViewOptions)

| Option              | Type                                                                            | Description                                           |
| ------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `dragStartCallback` | `(event: DragEvent, node: HTMLLIElement) => boolean`                            | Called when a drag starts. Return `false` to cancel.  |
| `dropCallback`      | `(event: DragEvent, location: DropLocation, nodes: HTMLLIElement[]) => boolean` | Called on drop. Return `false` to cancel move.        |
| `multipleSelection` | `boolean`                                                                       | Enable Shift/Ctrl/Meta selection. Default is `false`. |

---

### Public Methods

#### `append(element: HTMLLIElement, type: "item" | "group", parentGroup?: HTMLLIElement): HTMLLIElement`

Append an item or group to the root or a given group.

#### `insertBefore(element: HTMLLIElement, type: "item" | "group", referenceElement: HTMLLIElement): HTMLLIElement`

Insert a node before another.

#### `insertAt(element: HTMLLIElement, type: "item" | "group", index: number): HTMLLIElement | null`

Insert a node at a given index (only for root-level nodes).

#### `remove(element: HTMLLIElement): void`

Remove an item or group and its children.

#### `clear(): void`

Clear the tree and any current selection.

#### `scrollIntoView(element: Element): void`

Ensure the given element is visible and its ancestors expanded.

#### `moveVertically(offset: number): void`

Change selection (Up: `-1`, Down: `+1`).

#### `moveHorizontally(offset: number): void`

Collapse (`-1`) or expand (`+1`) groups.

---

## Events

The `TreeView` instance is an `EventTarget` and emits the following custom events:

| Event name        | Trigger                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `selectionChange` | When the user selects or deselects items/groups.                       |
| `activate`        | When the user double-clicks or presses Enter on a selected item/group. |

Use `addEventListener` to subscribe:

```ts
tree.addEventListener("selectionChange", () => {
  console.log("Selection changed!");
});

tree.addEventListener("activate", () => {
  console.log("Activated!");
});
```
