# `jolly-icon`

`jolly-icon` renders a glyph from the [icon registry](./registry.md).

```html
<jolly-icon name="search"></jolly-icon>
<jolly-icon name="close" label="Close panel"></jolly-icon>
```

## Properties

```ts
interface Icon {
  name: IconName;
  label: string; // empty: decorative, else an accessible image
  tone: IconTone | ""; // overrides the registered tone
  onFill: boolean; // attribute on-fill, lighter tone stop over an accent fill
}
```

- Glyphs use `currentColor`, unless [illustrated](./registry.md#illustrated-glyphs).
- The SVG takes the glyph's registered view box.

## Styling

```css
jolly-icon {
  --jolly-icon-size: 16px;
  --jolly-icon-tone-rest: 55%;
  --jolly-icon-tone-engaged: 100%;
  --jolly-icon-tone-strength: var(--jolly-icon-tone-rest);
}
```

- `--jolly-icon-tone-strength` is how much tone a glyph shows. Hosts raise it
  to the engaged stop on hover and selection.
- Set `--jolly-icon-tone-rest: 100%` on a scope for colour that is always on.
