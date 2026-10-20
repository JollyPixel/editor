# Theming and density

Pick light or dark and a row density, let users change both, restyle the
accent, and keep a canvas or a detached overlay in step with the page.

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
- `density`: `compact`, `default` or `comfortable`. It scales row heights and
  spacing.

## 2. Let users choose

```html
<jolly-pane heading="Settings">
  <jolly-theme-preferences
    layout="stack"
    storage-key="voxel-editor:appearance"
  ></jolly-theme-preferences>
</jolly-pane>
```

- It renders both controls, applies them to the nearest `jolly-scope` and
  stores them under `storage-key`.
- `layout="stack"` suits a vertical pane. The default `inline` flattens both
  controls into a toolbar row.
- Set `target` when the scope to restyle is not an ancestor.

## 3. Apply a stored appearance yourself

When the choice lives in an account or in a settings page, write the scope
attributes directly:

```ts
function applyAppearance(
  appearance: { theme: ThemeMode; density: Density; }
): void {
  for (const scope of document.querySelectorAll("jolly-scope")) {
    if (appearance.theme === "auto") {
      scope.removeAttribute("theme");
    }
    else {
      scope.setAttribute("theme", appearance.theme);
    }
    scope.setAttribute("density", appearance.density);
  }
}
```

`"auto"` is the absence of the attribute. `THEME_MODES` and `DENSITIES` list
the valid values.

## 4. Override tokens

Override semantic tokens on a scope or an ancestor:

```css
jolly-scope {
  --jolly-accent-fill: #ff6600;
  --jolly-label-width: 10ch;
}
```

The token list is in [Theme exports and tokens](../api/theme/tokens.md).
Tones (`tone="violet"` on a pane or dialog) recolour one area without
touching the scope.

## 5. Follow the theme in a canvas

A WebGL or 2D canvas does not read CSS. Resolve the page theme in code and
listen for changes:

```ts
import { DocumentTheme, resolveThemeColor } from "@jolly-pixel/ui";

const theme = new DocumentTheme();
scene.background = backgroundFor(theme.mode);

const stop = theme.follow((mode) => {
  scene.background = backgroundFor(mode);
});
```

`resolveThemeColor(element, "--jolly-surface")` turns a token into a colour a
canvas can use, `light-dark()` included.

## 6. Detached elements

An element appended to `document.body`, or one that declares its own tokens,
does not inherit a scope. Follow the page theme with
[`AmbientThemeController`](../api/theme/tokens.md#following-the-page-theme):

```ts
#theme = new AmbientThemeController(this);

show(): void {
  this.#theme.follow();
  this.dialog.showModal();
}
```

`jolly-dialog` and a floating facade `Pane` already do this.
