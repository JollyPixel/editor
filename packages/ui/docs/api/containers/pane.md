# `jolly-pane`

`jolly-pane` provides a header, actions slot, and content surface.

```html
<jolly-pane key="inspector" heading="Inspector" collapsible>
  <jolly-button slot="actions">Reset</jolly-button>
  <jolly-folder label="Transform"></jolly-folder>
</jolly-pane>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `heading` | `heading` | `string` | `""` |
| `key` | `key` | `string` | `""` |
| `reorderable` | `reorderable` | `boolean` | `false` |
| `collapsible` | `collapsible` | `boolean` | `false` |
| `collapsed` | `collapsed` | `boolean` | `false` |
| `grow` | `grow` | `boolean` | `false` |
| `dragging` | `dragging` | `boolean` | `false` |
| `locked` | `locked` | `boolean` | `false` |
| `movable` | `movable` | `boolean` | Derived from its container |
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |
| `presence` | none | `PresenceSource \| null` | `null` |

`actions` is the named header slot. The default slot contains pane content.
Collapsing emits `jolly-toggle` with `{ open }`. Committed folder ordering
emits `jolly-reorder` with `{ keys }`. The component exposes `header`, `title`,
`actions`, and `content` CSS parts. Dock layouts and floating windows set
`movable`; a dock layout sets `dragging` during a move preview.
