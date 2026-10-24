# Hierarchy panels

Show a layer or scene hierarchy with `jolly-tree`: selection, folding,
visibility, renaming, drag and drop and a row menu. The tree holds no state of
its own. Every intent is an event, and the panel writes the result back.

## 1. Render the nodes

```ts
import { LitElement, html, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { ContextMenu, Tree, TreeNode } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/tree";

@customElement("layer-panel")
export class LayerPanel extends LitElement {
  @property({ attribute: false })
  declare layers: LayerStore;

  @state()
  declare expanded: string[];

  @query("jolly-tree")
  declare tree: Tree;

  @query("jolly-context-menu")
  declare menu: ContextMenu;

  #nodes: TreeNode<Layer>[] = [];

  constructor() {
    super();
    this.expanded = [];
  }

  override render() {
    this.#nodes = this.layers.roots().map(toNode);

    return html`
      <jolly-tree
        reorderable
        renamable
        .nodes=${this.#nodes}
        .selected=${this.layers.selection}
        .expanded=${this.expanded}
        @jolly-select=${this.#onSelect}
        @jolly-toggle-expand=${this.#onToggleExpand}
        @jolly-toggle-visible=${this.#onToggleVisible}
        @jolly-rename=${this.#onRename}
        @jolly-reparent=${this.#onReparent}
        @jolly-context-request=${this.#menu.onContextRequest}
      ></jolly-tree>
      <jolly-context-menu
        label="Layer actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
    `;
  }
}

function toNode(
  layer: Layer
): TreeNode<Layer> {
  return {
    id: layer.id,
    label: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    renamable: !layer.locked,
    detail: String(layer.voxelCount),
    children: layer.isGroup ? layer.children.map(toNode) : undefined,
    data: layer
  };
}
```

- Rebuild `nodes` on every change. Rows are keyed by `id` and re-render only
  when something they show changes.
- A node with `children`, even an empty array, is a branch. Without it, the
  row is a leaf.
- `visible` and `locked` add the eye and lock toggles to the row.
- Subscribe the panel to the store, so a change made elsewhere renders it
  again. See [Keeping an element in sync](./syncing-with-a-model.md).

## 2. Write selection and folding back

```ts
import type {
  JollySelectDetail,
  JollyToggleExpandDetail,
  JollyToggleVisibleDetail
} from "@jolly-pixel/ui";

#onSelect = (event: CustomEvent<JollySelectDetail>) => {
  this.layers.select(event.detail.selected);
};

#onToggleExpand = (event: CustomEvent<JollyToggleExpandDetail>) => {
  const { id, expanded } = event.detail;
  this.expanded = expanded ?
    [...this.expanded, id] :
    this.expanded.filter((other) => other !== id);
};

#onToggleVisible = (event: CustomEvent<JollyToggleVisibleDetail>) => {
  this.layers.setVisible(event.detail.id, event.detail.visible);
};
```

- Assign a new array for `selected` and `expanded`. The tree compares them by
  content, and mutating the one it holds changes nothing.
- Clicking below the rows emits an empty selection. Set `require-selection`
  to keep one row selected.

## 3. Rename rows

```ts
import type { JollyRenameDetail } from "@jolly-pixel/ui";

#onRename = (event: CustomEvent<JollyRenameDetail>) => {
  this.layers.rename(event.detail.id, event.detail.name);
};
```

```ts
this.tree.validateRename = ({ id, name }) =>
  this.layers.siblingNamed(id, name) ? `"${name}" already exists here` : null;
```

- Double-click or F2 opens the field on a row with `renamable`. The tree
  emits the new name and does not write the label.
- A blank or unchanged name emits nothing.
- `validateRename` runs as the user types. Its message shows under the field,
  and Enter keeps the field open.

## 4. Move rows

```ts
import { resolveReparentMoves, type JollyReparentDetail } from "@jolly-pixel/ui";

#onReparent = (event: CustomEvent<JollyReparentDetail>) => {
  const moves = resolveReparentMoves({
    nodes: this.#nodes,
    ...event.detail
  });
  this.layers.move(moves);
};
```

```ts
this.tree.acceptDrop = ({ targetId, where }) =>
  where !== "inside" || this.layers.get(targetId)?.isGroup === true;
```

- `resolveReparentMoves` turns the drop into steps for a store that moves one
  node at a time: each puts a node under `parentId`, before `beforeId`.
- The tree already refuses a drop into a node's own subtree. `acceptDrop` adds
  the rules of the model. It runs on every pointer move, so keep it cheap.
- With `reorderable`, rows drag by a grip, which also works on touch. Add
  `row-drag` to drag the whole row. Space starts a keyboard move.

## 5. Add a row menu

```ts
import {
  ContextMenuController,
  MenuSession,
  disableEntries,
  showConfirm,
  type MenuEntry
} from "@jolly-pixel/ui";

type LayerAction = "rename" | "duplicate" | "delete";

const kLayerMenu: readonly MenuEntry<LayerAction>[] = [
  { id: "rename", label: "Rename" },
  { id: "duplicate", label: "Duplicate" },
  "separator",
  { id: "delete", label: "Delete", intent: "danger" }
];

#menu = new ContextMenuController(
  () => this.menu,
  (id) => (id === null ?
    MenuSession.EMPTY :
    MenuSession.forRow(
      disableEntries(kLayerMenu, (action) => action !== "duplicate" && this.layers.isLocked(id)),
      () => this.layers.has(id),
      (action) => this.#actions[action](id)
    ))
);

#actions: Record<LayerAction, (id: string) => Promise<void> | void> = {
  rename: (id) => {
    this.tree.beginRename(id);
  },
  duplicate: (id) => this.layers.duplicate(id),
  delete: async(id) => {
    if (await showConfirm({ title: "Delete layer?", message: "This cannot be undone.", danger: true })) {
      this.layers.remove(id);
    }
  }
};
```

- Right-click, Shift+F10 or the menu key emits `jolly-context-request`. The
  tree selects and focuses the row first.
- `id` is `null` below the rows. `MenuSession.EMPTY` opens nothing there.
- `forRow` drops the action when the row no longer exists, for a row a peer
  deleted while the menu was open.
- The menu returns focus to the row before it runs the action, so
  `beginRename` finds the row focused.

## 6. Drag rows out of the tree

`dragOut` lets a row drag end on another element, such as the viewport:

```ts
this.tree.dragOut = {
  over: ({ clientX, clientY }) => {
    const inside = contains(this.viewport, clientX, clientY);
    this.viewport.classList.toggle("drop-target", inside);

    return inside;
  },
  drop: ({ movedIds, clientX, clientY }) => {
    this.viewport.classList.remove("drop-target");
    this.scene.place(movedIds, clientX, clientY);
  },
  leave: () => this.viewport.classList.remove("drop-target")
};
```

- Returning `true` from `over` claims the point: the tree draws no drop line
  and emits no `jolly-reparent` there.
- Keyboard moves never leave the tree.

## Going further

- A `searchable` pane sends its query to the elements it slots. Forward it to
  the tree, which hides the rows that do not match:

  ```ts
  applySearch(query: SearchQuery): number {
    return this.tree?.applySearch(query) ?? 0;
  }
  ```

- `badges` show which peers have a row selected. See
  [Collaboration](./collaboration.md).
- `virtual` renders only the rows near the viewport, for long trees.
