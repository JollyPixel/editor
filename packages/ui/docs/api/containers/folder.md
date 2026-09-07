# `jolly-folder`

`jolly-folder` groups rows under a collapsible header.

```html
<jolly-folder key="transform" label="Transform">
  <jolly-vector3 label="Position"></jolly-vector3>
</jolly-folder>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `label` | `label` | `string` | `""` |
| `key` | `key` | `string` | `""` |
| `open` | `open` | `boolean` | `true` |
| `collapsible` | `collapsible` | `boolean` | `true` |
| `reorderable` | `reorderable` | `boolean` | `false` |
| `dragging` | `dragging` | `boolean` | `false` |
| `flush` | `flush` | `boolean` | `false` |
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |

Header activation emits `jolly-toggle` with `{ open }`. A reorderable folder
shows a grip when its owning pane permits folder reordering. The component
exposes `header` and `content` CSS parts. Its owning pane sets `dragging` during
a pointer reorder preview.

## Non-collapsible folders

Set `collapsible` to `false` as a JavaScript property. The folder stays open,
ignores stored `open` state, and renders its title without a collapse button or
chevron.

```ts
html`<jolly-folder .collapsible=${false} label="Block Library"></jolly-folder>`
```

Because `collapsible` defaults to `true` and reflects, an absent attribute or
`?collapsible=${false}` does not disable it. Outside Lit, assign
`folder.collapsible = false`. Open content grows with a stretched host.

## Indentation

`--jolly-folder-indent` sets the content's inline-start padding and defaults to
`--jolly-space-1`; nesting compounds it. Set `flush` on one folder, or set the
custom property to `0` on an ancestor, to flatten its content.

## Header actions

Elements assigned to the `actions` slot sit in the header, between the label and
the grip, and stay visible while the folder is shut.

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

An action is a sibling of the collapse toggle, not a child of it, so activating
one leaves `open` alone. A folder that should reveal itself when its own action
runs opens itself from the handler. A drag ghost clones the folder without its
light DOM, so actions do not ride along with a reorder.

Slotted `jolly-button` actions use inverted header colors. The `danger` variant
reads `--jolly-folder-action-danger-fg`, `--jolly-folder-action-danger-bg`,
`--jolly-folder-action-danger-bg-hover`, and
`--jolly-folder-action-danger-bg-focus`.
