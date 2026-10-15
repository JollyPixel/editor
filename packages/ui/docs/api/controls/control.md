# `jolly-control`

`jolly-control` renders one input hint inside
[`jolly-controls`](./controls.md). The host has `role="listitem"`.

```html
<jolly-control
  description="Sprint"
  details="Moves faster while the key is held"
><kbd>Shift</kbd><kbd>W</kbd></jolly-control>
```

## Properties

```ts
interface Control {
  description: string;
  details: string; // adds an information button and popover
}
```

The default slot takes one or more `kbd` elements.
