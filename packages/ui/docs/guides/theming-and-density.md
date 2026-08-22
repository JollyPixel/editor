# Theming and density

Components consume inherited custom properties declared by `themeStyles`.
Apply the stylesheet to a shadow-root scope host or wrap HTML in `jolly-scope`.

```html
<jolly-scope theme="dark" density="compact">
  <jolly-pane heading="Inspector"></jolly-pane>
</jolly-scope>
```

`theme` accepts `light` or `dark`. An absent theme follows the system color
scheme. `density` accepts `compact`, `default`, or `comfortable`.

`jolly-theme-preferences` renders the theme and density controls, applies their
values to a target scope, and persists them when `storage-key` is set.

Applications should override semantic tokens on a scope or an ancestor:

```css
jolly-scope {
  --jolly-accent-fill: #ff6600;
  --jolly-label-width: 10ch;
}
```

The exported `themeTokens`, `densityTokens`, and `scaleTokens` contain the
token styles. [`themeStyles`](../api/theme/README.md) combines the theme token
sets with the package font and theme selectors.
