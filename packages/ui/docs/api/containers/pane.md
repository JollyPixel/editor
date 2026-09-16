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
| `icon` | `icon` | `IconName` | `""` |
| `key` | `key` | `string` | `""` |
| `reorderable` | `reorderable` | `boolean` | `false` |
| `collapsible` | `collapsible` | `boolean` | `false` |
| `collapsed` | `collapsed` | `boolean` | `false` |
| `grow` | `grow` | `boolean` | `false` |
| `dragging` | `dragging` | `boolean` | `false` |
| `locked` | `locked` | `boolean` | `false` |
| `grouped` | `grouped` | `boolean` | Derived from its parent |
| `inactive` | `inactive` | `boolean` | Set by its group |
| `floatWidth` | `float-width` | `number \| undefined` | `undefined` |
| `floatHeight` | `float-height` | `number \| undefined` | `undefined` |
| `movable` | `movable` | `boolean` | Derived from its container |
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |
| `presence` | none | `PresenceSource \| null` | `null` |

`actions` is the named header slot. The default slot contains pane content.
Collapsing emits `jolly-toggle` with `{ open }`. Committed folder ordering
emits `jolly-reorder` with `{ keys }`. A non-empty `icon` renders a registered
glyph before the title. The component exposes `header`, `icon`, `title`,
`actions`, and `content` CSS parts. Dock layouts and floating windows set
`movable`; a dock layout sets `dragging` during a move preview. A pane inside a
`jolly-pane-group` is `grouped`, and `inactive` while another tab is shown.
`floatWidth` and `floatHeight` size, in pixels, the window a dock layout opens
when the pane is first dragged out of its dock.

While its grip is grabbed, Up and Down move the pane within its dock, Left and
Right send it to the adjacent dock, and Shift with Up or Down joins it to the
group above or below. Space commits and Escape cancels.
