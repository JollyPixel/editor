# `jolly-fields`

`jolly-fields` stacks fields in a column with the row gap, for a form inside
a [dialog](./dialog.md) or a pane section that is not a
[folder](./folder.md).

```html
<jolly-fields>
  <jolly-text label="Name"></jolly-text>
  <jolly-number label="Columns"></jolly-number>
</jolly-fields>
```

## Styling

- Children are separated by `--jolly-row-gap` (default `4px`).
- The element sets no padding. Set the shared label column on it:

```css
jolly-fields {
  --jolly-label-width: 80px;
}
```
