# Theming and density

## 1. Add a scope

Components read inherited custom properties declared by `themeStyles`. Wrap
HTML in [`jolly-scope`](../api/theme/scope-host.md), or apply `themeStyles` to
a shadow root of your own.

```html
<jolly-scope theme="dark" density="compact">
  <jolly-pane heading="Inspector"></jolly-pane>
</jolly-scope>
```

- `theme`: `light` or `dark`. Absent, it follows the system colour scheme.
- `density`: `compact`, `default` or `comfortable`.

## 2. Let users choose

[`jolly-theme-preferences`](../api/theme/theme-preferences.md) renders both
controls, applies them to the nearest scope and stores them under
`storage-key`.

## 3. Override tokens

Override semantic tokens on a scope or an ancestor:

```css
jolly-scope {
  --jolly-accent-fill: #ff6600;
  --jolly-label-width: 10ch;
}
```

The token list is in [Theme exports and tokens](../api/theme/tokens.md).

## Detached elements

An element appended to `document.body`, or one that declares its own tokens,
does not inherit a scope. Follow the page theme with
[`AmbientThemeController`](../api/theme/tokens.md#following-the-page-theme).
