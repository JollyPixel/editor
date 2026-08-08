# PixelDrawPanel

Drop-in web component. Rail (mode buttons, colors) + canvas, wired to a `PixelArtCanvas` for you. Undo/redo and import/export float in a toolbar at the bottom of the canvas, visible in every mode — same floating-pill style as the UV toolbar at the top. This is what the `examples/` demo uses — grab it instead of rebuilding a toolbar around `PixelArtCanvas` yourself.

```ts
import "@jolly-pixel/editor.pixel-art";
import type {
  PixelDrawPanel
} from "@jolly-pixel/editor.pixel-art";
```

```html
<pixel-draw-panel style="width: 640px; height: 480px;"></pixel-draw-panel>
```

```ts
const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
const canvas = await panel.initialize({
  texture: { size: { x: 64, y: 64 } },
  defaultMode: "paint"
});
```

`initialize(options?)` takes the same `PixelArtCanvasOptions` as `new PixelArtCanvas(...)` (see [PixelArtCanvas.md](../../../../pixel-draw-renderer/docs/PixelArtCanvas.md)) and resolves with the created instance. Must `await` it — the canvas host div only exists after Lit's first render.

## API

| Member | What it does |
|---|---|
| `initialize(options?)` | Creates the `PixelArtCanvas`, returns it. Call once. |
| `canvasManager` | The live `PixelArtCanvas`, or `null` before `initialize()`. |
| `onResize()` | Call on container resize (ResizeObserver, split-pane drag, etc). |
| `allow-uv-create-delete` attribute / `allowUvCreateDelete` property | Shows the Create/Delete buttons in the UV toolbar. Off by default: creating/deleting regions only makes sense when the panel owns the UV layout (the package's own example); embeddings over a fixed mesh (e.g. voxel-map) leave it off. |
| `theme` attribute / property (`"light" \| "dark" \| "auto"`, default `"auto"`) | Selects the palette. `"auto"` follows `prefers-color-scheme`; `"light"`/`"dark"` force one regardless of the OS setting. Reflects to the attribute. |

Destruction is automatic: `disconnectedCallback()` calls `canvasManager.destroy()` when the element leaves the DOM.

> [!NOTE]
> Everything is shadow-DOM scoped — no global CSS required. Both palettes are `:host`-scoped CSS custom properties keyed off the `theme` attribute (see `theme.ts`); override the custom properties on `pixel-draw-panel` from outside if you need a different palette than the two built in.

## Sub-elements

Also exported from `@jolly-pixel/editor.pixel-art`, in case you want to compose your own layout instead of the full panel: `ModeRail` (`<mode-rail>`), `ColorPickerRail` (`<color-picker-rail>`), `ColorSwatch` (`<color-swatch>`, wraps `vanilla-picker`). They're fully controlled (props in, events out) — see `PixelDrawPanel.ts` for how they're wired together.

> [!IMPORTANT]
> `lit` and `vanilla-picker` are real `dependencies` of this package (not dev-only) — they ship at runtime for anyone importing it.
