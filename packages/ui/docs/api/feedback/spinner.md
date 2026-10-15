# `jolly-spinner`

`jolly-spinner` is a busy indicator for an operation of unknown duration. Use
[`jolly-progress`](./progress.md) when a ratio is known.

```html
<jolly-spinner label="Adding texture"></jolly-spinner>
```

## Properties

```ts
interface Spinner {
  label: string;
}
```

- A `label` makes the element a `status` with that name. Without one, it is
  hidden from assistive technology, as inside an already labelled control.
- Under `prefers-reduced-motion: reduce`, the rotation becomes an opacity
  pulse.

## Styling

```css
jolly-spinner {
  --jolly-spinner-size: 1em; /* outer diameter */
  --jolly-spinner-thickness: 2px;
  --jolly-spinner-color: currentColor; /* leading arc */
  --jolly-spinner-duration: 700ms; /* one rotation */
}
```

`--jolly-spinner-track` colours the rest of the ring, default 24% of the
colour. The ring is the `spinner` part.
