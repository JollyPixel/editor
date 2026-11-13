# `jolly-rail-group`

`jolly-rail-group` lays out a run of related controls inside a
[`jolly-rail`](./rail.md), and can draw a divider before itself.

```html
<jolly-rail orientation="horizontal" floating role="toolbar" aria-label="Tools">
  <jolly-rail-group role="group" aria-label="History">
    <jolly-tool-button icon="undo" label="Undo"></jolly-tool-button>
    <jolly-tool-button icon="redo" label="Redo"></jolly-tool-button>
  </jolly-rail-group>
  <jolly-rail-group divided role="group" aria-label="Clipboard">
    <jolly-tool-button icon="duplicate" label="Duplicate"></jolly-tool-button>
  </jolly-rail-group>
</jolly-rail>
```

## Properties

```ts
interface RailGroup {
  divided: boolean; // default false
}
```

- The group is a row of its children, centred on the cross axis.
- `divided` draws a 1px by 22px rule in `--jolly-divider` before the
  children, with `--jolly-rail-group-divider-inset` (`6px`) on each side.
- The element sets no role; give it `role="group"` and an `aria-label` when
  the controls form a named set.

## Styling

`--jolly-rail-group-divider-inset` takes a `margin-inline` value, so it can
set the two sides apart:

```css
jolly-rail-group {
  --jolly-rail-group-divider-inset: 6px 2px;
}
```
