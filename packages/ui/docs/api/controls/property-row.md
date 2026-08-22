# `jolly-property-row`

`jolly-property-row` aligns custom slotted content with field rows.

```html
<jolly-property-row label="Export" description="Writes to the project folder">
  <jolly-button>PNG</jolly-button>
</jolly-property-row>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `label` | `label` | `string` | `""` |
| `description` | `description` | `string` | `""` |
| `align` | `align` | `"start" \| "end"` | `"start"` |
| `labelPosition` | `label-position` | `"inline" \| "top"` | `"inline"` |

The default slot supplies the row content. The component has no value or field
events.
