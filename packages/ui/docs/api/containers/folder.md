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
| `reorderable` | `reorderable` | `boolean` | `false` |
| `dragging` | `dragging` | `boolean` | `false` |
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |

Header activation emits `jolly-toggle` with `{ open }`. A reorderable folder
shows a grip when its owning pane permits folder reordering. The component
exposes `header` and `content` CSS parts. Its owning pane sets `dragging` during
a pointer reorder preview.
