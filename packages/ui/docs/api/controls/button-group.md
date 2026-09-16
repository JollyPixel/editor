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

| Property | Attribute | Type | Default |
|---|---|---|---|
| `options` | | `JollyOption<T>[]` | `[]` |
| `layout` | `layout` | `"segmented" \| "grid"` | `"segmented"` |
| `columns` | `columns` | `number` | `0` |
| `iconOnly` | `icon-only` | `boolean` | `false` |

`columns = 0` lets the grid choose its column count. The group has one tab
stop. Arrow keys move between enabled options. A selection emits
`jolly-change`.

An option with an `icon` renders that [registered icon](../icon/registry.md)
before its label. Each segment shows its label as a tooltip. `iconOnly` hides
the labels visually; they still name the segments for assistive technology.

```html
<jolly-button-group icon-only aria-label="Tool"></jolly-button-group>
```

The radio group is named by `label`. A group with no visible label falls back
to an `aria-label` on the element, so dropping the label column to save width
keeps the group named.
