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
