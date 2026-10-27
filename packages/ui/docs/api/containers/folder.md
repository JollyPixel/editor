# `jolly-folder`

`jolly-folder` groups rows under a collapsible header.

```html
<jolly-folder key="transform" label="Transform">
  <jolly-vector3 label="Position"></jolly-vector3>
</jolly-folder>
```

## Properties

```ts
interface Folder {
  label: string;
  key: string;
  open: boolean; // default true
  collapsible: boolean; // default true
  reorderable: boolean; // shows the grip, set by a reorderable pane
  flush: boolean; // no content indent
  storageKey: string; // attribute storage-key
  storage: StorageAdapter; // property only, default LocalStorageAdapter

  dragging: boolean; // set by its pane during a reorder preview
  grabbed: boolean; // set by its pane while moved with the keyboard
}
```

## Events

```ts
interface FolderEvents {
  "jolly-toggle": { open: boolean; };
  "jolly-folder-drag": { folder: Folder; event: PointerEvent; };
  "jolly-folder-reorder": {
    folder: Folder;
    command: "start" | "up" | "down" | "finish" | "cancel";
  };
}
```

## Reordering

The grip asks for a move and leaves the order to whoever handles the events.
A [reorderable pane](./pane.md) handles them for the folders slotted in it.
Elsewhere, set `reorderable` and hand the events to a
[`FolderReorder`](./folder-reorder.md):

- A primary-button press on the grip emits `jolly-folder-drag` with the
  `pointerdown` event, only while `reorderable`.
- Space on the grip emits `start`, or `finish` while `grabbed`. While
  `grabbed`, ArrowUp and ArrowDown emit `up` and `down`, and Escape emits
  `cancel`.
- The folder never sets `grabbed` itself. The handler sets it on `start` and
  clears it when the move ends.

## Slots and parts

- Slots: default (content), `actions` (header).
- Parts: `header`, `content`.

## Non-collapsible folders

`collapsible` defaults to `true` and reflects, so an absent attribute or
`?collapsible=${false}` does not turn it off. Set the property instead:

```ts
html`<jolly-folder .collapsible=${false} label="Block Library"></jolly-folder>`
```

- The folder stays open and ignores stored `open` state.
- The title has no collapse button or chevron.
- Open content grows with a stretched host.

## Indentation

- `--jolly-folder-indent` sets the content's inline-start padding, default
  `--jolly-space-1`. Nesting adds up.
- `flush`, or the property set to `0` on an ancestor, flattens the content.

## Long folders

Wrap the rows in a [`jolly-show-more`](./show-more.md) to show the first few
and fold the rest behind a "Show N more" button.

## Header actions

`actions` elements sit between the label and the grip, and stay visible while
the folder is shut.

```html
<jolly-folder label="Block Library">
  <jolly-button
    slot="actions"
    icon="plus"
    icon-only
    label="Add block"
    title="Add block"
  ></jolly-button>
  <block-library></block-library>
</jolly-folder>
```

- Activating an action leaves `open` alone. Open the folder from the handler
  when the action should reveal it.
- Actions do not appear in the reorder drag ghost.
- Slotted `jolly-button` actions are small chips. A slotted
  [`jolly-search`](../controls/search.md) gets the same size and fill. A custom
  action matches their height with `--jolly-folder-action-size`.
- Chips fill with the accent mixed into `--jolly-surface-raised`, or the area
  fill of a toned pane.
- Restyle them with `--jolly-folder-action-fg`, `-bg`, `-bg-hover`,
  `-bg-focus` and `-bg-active`. The `danger` variant reads
  `--jolly-folder-action-danger-fg`, `-bg`, `-bg-hover` and `-bg-focus`.

## Searching

In a [searchable pane](./pane.md#searching-content):

- A folder whose `label` matches stays visible with all its content.
- Otherwise it filters its content like the pane does, and the pane hides it
  when nothing inside matches.
- A closed folder with a match opens while the search lasts, without storing
  `open`, and cannot be collapsed until the search clears.
