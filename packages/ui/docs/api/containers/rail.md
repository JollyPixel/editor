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
  floating: boolean;
}
```

`floating` draws the rail as a raised strip with a shadow, for a toolbar over
a viewport. A horizontal floating rail wraps its items onto more rows when it
runs out of width.
