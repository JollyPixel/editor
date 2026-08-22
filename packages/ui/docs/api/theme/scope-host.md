# `jolly-scope`

`jolly-scope` applies `themeStyles` to slotted content.

```html
<jolly-scope theme="dark" density="compact">
  <jolly-pane heading="Inspector"></jolly-pane>
</jolly-scope>
```

The component has no declared JavaScript properties. `theme` and `density`
attributes are consumed by `themeStyles`. The default slot contains themed
content. Application CSS chooses the host display and layout behavior.
