# `jolly-rail`

`jolly-rail` is a compact strip for persistent controls. It provides layout
only, with no toolbar role.

```html
<jolly-rail>
  <jolly-button icon="search" label="Search" icon-only></jolly-button>
</jolly-rail>
```

## Properties

```ts
interface Rail {
  orientation: "horizontal" | "vertical"; // default "vertical"
}
```
