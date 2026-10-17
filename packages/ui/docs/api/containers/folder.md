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
  reorderable: boolean; // shows a grip when its pane allows reordering
  flush: boolean; // no content indent
  storageKey: string; // attribute storage-key
  storage: StorageAdapter; // property only, default LocalStorageAdapter

  dragging: boolean; // set by its pane during a reorder preview
}
```

## Events

```ts
interface FolderEvents {
  "jolly-toggle": { open: boolean; };
}
```

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
