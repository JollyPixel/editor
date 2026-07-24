# PixelDrawPanel

Drop-in web component. Rail (mode buttons, colors, undo/redo, import/export) + canvas, wired to a `PixelArtCanvas` for you. This is what the `examples/` demo uses — grab it instead of rebuilding a toolbar around `PixelArtCanvas` yourself.

```ts
import "@jolly-pixel/pixel-draw.renderer/ui";
import type {
  PixelDrawPanel
} from "@jolly-pixel/pixel-draw.renderer/ui";
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

`initialize(options?)` takes the same `PixelArtCanvasOptions` as `new PixelArtCanvas(...)` (see [PixelArtCanvas.md](../PixelArtCanvas.md)) and resolves with the created instance. Must `await` it — the canvas host div only exists after Lit's first render.

## API

| Member | What it does |
|---|---|
| `initialize(options?)` | Creates the `PixelArtCanvas`, returns it. Call once. |
| `canvasManager` | The live `PixelArtCanvas`, or `null` before `initialize()`. |
| `onResize()` | Call on container resize (ResizeObserver, split-pane drag, etc). |

Destruction is automatic: `disconnectedCallback()` calls `canvasManager.destroy()` when the element leaves the DOM.

> [!NOTE]
> Everything is shadow-DOM scoped — no global CSS required. Theme is a handful of `:host` CSS custom properties (see `theme.ts`); override them on `pixel-draw-panel` from outside if you need a different palette.

## Sub-elements

Also exported from `@jolly-pixel/pixel-draw.renderer/ui`, in case you want to compose your own layout instead of the full panel: `ModeRail` (`<mode-rail>`), `ColorPickerRail` (`<color-picker-rail>`), `ColorSwatch` (`<color-swatch>`, wraps `vanilla-picker`). They're fully controlled (props in, events out) — see `PixelDrawPanel.ts` for how they're wired together.

> [!IMPORTANT]
> `lit` and `vanilla-picker` are real `dependencies` of this package (not dev-only) — they ship at runtime for anyone importing `./ui`.
