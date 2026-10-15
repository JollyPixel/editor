# `jolly-slider`

`jolly-slider` combines a native range with an editable numeric readout. It
implements the [shared field API](../field/shared-field-api.md).

```html
<jolly-slider label="Opacity" min="0" max="1" step="0.01"></jolly-slider>
```

## Properties

```ts
interface Slider {
  step: number; // default 1
  min: number; // default 0
  max: number; // default 100
  value: number | typeof Mixed; // default 0
  orientation: "horizontal" | "vertical"; // default "horizontal"
}
```

- Range movement emits `jolly-input`, release emits `jolly-change`.
- The readout follows the [`jolly-number`](./number.md) entry rules.
- A vertical slider puts the maximum at the top and the readout above.
  `--jolly-slider-length` sets the lane height (`120px`).

```html
<jolly-slider orientation="vertical" min="1" max="8"></jolly-slider>
```
