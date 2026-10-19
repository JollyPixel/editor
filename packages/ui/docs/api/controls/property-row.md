# `jolly-property-row`

`jolly-property-row` aligns custom slotted content with field rows. It has no
value and no field events.

```html
<jolly-property-row label="Export" description="Writes to the project folder">
  <jolly-button>PNG</jolly-button>
</jolly-property-row>
```

## Properties

```ts
interface PropertyRow {
  label: string;
  description: string;
  align: "start" | "end"; // default "start"
  labelPosition: "inline" | "top" | "auto"; // attribute label-position
  stackBelow: number; // attribute stack-below, default 200
  descriptionDisplay: "block" | "tooltip"; // attribute description-display
}
```

- Layout and description options work as on a
  [field](../field/shared-field-api.md#label-position), `stacked` included.
- The row follows the field
  [insets](../field/shared-field-api.md#insets).
- `applySearch(query)` matches on `label`, like a field.
