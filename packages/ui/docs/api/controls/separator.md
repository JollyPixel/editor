# `jolly-separator`

`jolly-separator` draws a divider between control groups.

```html
<jolly-separator></jolly-separator>
<jolly-separator label="Rendering"></jolly-separator>
```

## Properties

```ts
interface Separator {
  label: string; // visible caption and accessible name
}
```

The caption lines up with field labels: it follows
[`--jolly-field-inset-start`](../field/shared-field-api.md#insets).

## Trailing actions

`actions` elements sit after the rule, on the same row, without changing its
height. They are siblings of the `separator` role, so assistive technology
reaches them.

```html
<jolly-separator label="Layer">
  <jolly-button
    slot="actions"
    icon="transform"
    icon-only
    label="Transform"
  ></jolly-button>
</jolly-separator>
```
