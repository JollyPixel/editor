# `jolly-controls`

`jolly-controls` positions a card of [`jolly-control`](./control.md) entries
over a scene.

```html
<div class="scene">
  <jolly-controls position="bottom-left" heading="Controls">
    <jolly-control description="Jump"><kbd>Space</kbd></jolly-control>
  </jolly-controls>
</div>
```

## Properties

```ts
interface Controls {
  position: ControlsPosition; // default "bottom-left"
  maxEntriesPerRow: number; // attribute max-entries-per-row, default 3
  heading: string;
}
```

- `position` takes the nine combinations from `top-left` to `bottom-right`,
  `middle` included.
- The element is absolutely positioned: the scene needs a positioning context.
