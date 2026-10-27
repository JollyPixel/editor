# `FolderReorder`

`FolderReorder` handles the grip of the `jolly-folder` elements in a list and
asks its owner to commit the new order. A [reorderable pane](./pane.md) uses it
for its slotted folders. Use it where folders are rendered from a model, such
as the components of an inspected object.

```ts
import { FolderReorder } from "@jolly-pixel/ui";

new FolderReorder(
  host: ReactiveControllerHost,
  options: FolderReorderOptions
)

interface FolderReorderOptions {
  folders(): readonly Folder[]; // the committed order
  zone(): HTMLElement; // drop area of a pointer drag
  commit(order: readonly Folder[], folder: Folder): void;
  announce(message: string): void;
}
```

```ts
interface FolderReorder {
  onDrag(event: CustomEvent<{ folder: Folder; event: PointerEvent; }>): void;
  onReorder(event: CustomEvent<{
    folder: Folder;
    command: "start" | "up" | "down" | "finish" | "cancel";
  }>): void;
  cancel(): void;
}
```

Bind `onDrag` to `jolly-folder-drag` and `onReorder` to
`jolly-folder-reorder` on an ancestor of the folders. Both stop propagation.
Set `reorderable` on the folders yourself.

- A pointer drag shows the folder header as a ghost and an insertion line in
  `zone()`. The folder is `dragging` while it lasts.
- Space grabs the folder and sets its `grabbed`. ArrowUp and ArrowDown preview
  the move through `style.order`, Space drops and Escape cancels. The
  `style.order` values from before the grab come back on drop or cancel,
  before `commit` runs.
- `commit` receives the whole order and the moved folder, only when the order
  changed. Write it to the model; the controller does not reorder the DOM.
- `announce` receives the grab, position, drop and cancel messages. Show them
  in an `aria-live` region.
- Only one gesture runs at a time. A grab or drag that starts during another
  is ignored, and the folder stays released.
- A gesture is cancelled when the host disconnects, when `folders()` returns a
  different list after a host update, or on `cancel()`.

```ts
#reorder = new FolderReorder(this, {
  folders: () => [...this.renderRoot.querySelectorAll<Folder>(".list > jolly-folder")],
  zone: () => this.#list(),
  commit: (order, folder) => this.model.move(
    folder.key,
    order[order.indexOf(folder) + 1]?.key
  ),
  announce: (message) => {
    this.#announcement = message;
    this.requestUpdate();
  }
});
```
