# `jolly-toolbar`

`jolly-toolbar` supplies toolbar semantics and flex layout.

```html
<jolly-toolbar label="Editing tools">
  <jolly-button>Move</jolly-button>
  <jolly-button>Paint</jolly-button>
</jolly-toolbar>
```

| Property | Type | Default |
|---|---|---|
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` |
| `label` | `string` | `""` |

The default slot contains toolbar controls. Set a non-empty `label` to name the
toolbar for assistive technology.

The toolbar row fills the host, so a slotted control with a `flex` grow factor
takes the free space. Give icon-only buttons `--jolly-icon-button-size: 100%`
so they stretch with it.
