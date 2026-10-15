# `jolly-button-group`

`jolly-button-group` edits one value through a segmented row or grid of
buttons. It implements the [shared field API](../field/shared-field-api.md).

```ts
const field = document.querySelector("jolly-button-group");
field.options = [
  { value: "move", label: "Move", icon: "drag" },
  { value: "paint", label: "Paint" }
];
field.value = "move";
```

## Properties

```ts
interface ButtonGroup<T> {
  options: JollyOption<T>[]; // property only
  layout: "segmented" | "grid"; // default "segmented"
  columns: number; // 0 lets the grid choose
  iconOnly: boolean; // attribute icon-only
}
```

## Behaviour

- One tab stop. Arrow keys move between enabled options.
- A selection emits `jolly-change`.
- An option `icon` renders a [registered icon](../icon/registry.md) before the
  label. Each segment shows its label as a tooltip.
- `iconOnly` hides the labels visually. They still name the segments.
- The radio group is named by `label`, or by the element's `aria-label` when
  the label is empty.

```html
<jolly-button-group icon-only aria-label="Tool"></jolly-button-group>
```
