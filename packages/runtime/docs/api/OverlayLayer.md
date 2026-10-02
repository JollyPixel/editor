# OverlayLayer

`runtime.overlay` holds the HTML drawn above the canvas: the performance HUD,
the focus hint, and the application's own elements. It exists once
`Runtime.create()` resolves and is removed by `runtime.dispose()`.

The layer never receives pointer events. By default it is a `position: fixed`
element on `document.body` that follows the canvas box. It sets no `z-index`,
so style `element` when other positioned elements sit above the canvas.

With the runtime's `overlay.container` option, the layer fills that element
instead and does no tracking. The container must be positioned and wrap the
canvas.

```ts
const mounted = runtime.overlay.mount(badge, {
  position: "bottom-right"
});

mounted.dispose();
```

## Members

| Member | Description |
|---|---|
| `element` | The layer's `HTMLDivElement`. |
| `mount(content, options?)` | Wraps `content` in an anchored slot. Returns a `MountedOverlay` whose `dispose()` removes it. |
| `dispose()` | Removes the layer. |

### Mount options

| Option | Default | Description |
|---|---|---|
| `position` | `"top-left"` | [`OverlayPosition`](#overlayposition) of the slot. |
| `inset` | `8` | Distance in pixels from the anchored edges. Also caps the slot to the layer size minus twice this value. |
| `interactive` | `false` | Lets the content receive pointer events. |

## OverlayPosition

- `"top-left"`
- `"top-center"`
- `"top-right"`
- `"middle-left"`
- `"center"`
- `"middle-right"`
- `"bottom-left"`
- `"bottom-center"`
- `"bottom-right"`
