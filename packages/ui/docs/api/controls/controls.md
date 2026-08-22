# `jolly-controls`

`jolly-controls` positions a card of `jolly-control` entries over a scene.

```html
<div class="scene">
  <jolly-controls position="bottom-left" heading="Controls">
    <jolly-control description="Jump"><kbd>Space</kbd></jolly-control>
  </jolly-controls>
</div>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `position` | `position` | `ControlsPosition` | `"bottom-left"` |
| `maxEntriesPerRow` | `max-entries-per-row` | `number` | `3` |
| `heading` | `heading` | `string` | `""` |

`position` accepts the nine combinations from `top-left` through
`bottom-right`, including `middle`. The component is absolutely positioned;
its containing scene should establish a positioning context. The default slot
contains `jolly-control` entries.
