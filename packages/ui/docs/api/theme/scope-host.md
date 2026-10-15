# `jolly-scope`

`jolly-scope` applies `themeStyles` to its slotted content.

```html
<jolly-scope theme="dark" density="compact">
  <jolly-pane heading="Inspector"></jolly-pane>
</jolly-scope>
```

- `theme`: `light` or `dark`. Absent, it follows the system colour scheme.
- `density`: `compact`, `default` or `comfortable`.
- Both are plain attributes read by `themeStyles`; the element declares no
  JavaScript property.
- Application CSS chooses the host display and layout.
