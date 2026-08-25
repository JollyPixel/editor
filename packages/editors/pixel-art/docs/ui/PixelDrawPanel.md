# PixelDrawPanel

Drop-in web component with a mode rail, color controls, canvas and floating toolbars wired to a `PixelArtCanvas`. Undo, redo, import, export and transparent-texture reset remain visible at the bottom. UV and Select actions appear at the top in their respective modes.

The UV toolbar includes independent toggles for region labels and showing every region. Labels display `(name)` or `(id)` inside collapsed UVs, with the face on a second line when uncollapsed. Show All forces labels while active and restores the prior label preference when disabled.

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

## Select toolbar and clipboard

Select mode shows Copy, Paste, Rotate Clockwise, Flip Horizontal, Flip Vertical and Delete. Paste stays enabled without a selection. Other actions enable after a completed rectangle, shape or paste. Clipboard failures appear beside the toolbar in a polite live region and clear automatically or when Select mode exits.

Copy uses PNG plus optional JollyPixel selection metadata, which carries raw RGBA so a JollyPixel-to-JollyPixel round trip is exact. External PNG, JPEG, WebP and GIF clipboard images appear as pixel-sharp floating selections and switch the mode rail to Select. They land centered on the texture cursor, or on the center of the visible view when the pointer is off the texture, pulled inside the texture bounds either way. Deselecting a floating paste deposits it; Delete cancels it. Plain HTTP or denied clipboard access falls back to the renderer's internal clipboard.

## Texture drop

Drag one local PNG, JPEG, WebP or GIF over the rendered texture rectangle to show the dashed replacement overlay. The surrounding stage, mode rail and toolbars are not drop targets. A successful drop replaces the texture through normal history and synchronization, centers it and preserves the current drawing mode. Multiple files, directories, URLs, SVG and invalid or oversized images leave the texture unchanged.

## API

| Member | What it does |
|---|---|
| `initialize(options?)` | Creates the `PixelArtCanvas`, returns it. Call once. |
| `canvasManager` | The live `PixelArtCanvas`, or `null` before `initialize()`. |
| `onResize()` | Call on container resize (ResizeObserver, split-pane drag, etc). |
| `allow-uv-create-delete` attribute / `allowUvCreateDelete` property | Shows the Create/Delete buttons in the UV toolbar. Off by default: creating/deleting regions only makes sense when the panel owns the UV layout (the package's own example); embeddings over a fixed mesh (e.g. voxel-map) leave it off. |
| `theme` attribute / property (`"light" \| "dark" \| "auto"`, default `"auto"`) | Selects the palette. `"auto"` follows the theme scope the panel is embedded in (`jolly-scope`, or any themed ancestor), falling back to `prefers-color-scheme` when there is none; `"light"`/`"dark"` force one regardless. Reflects to the attribute. |

Destruction is automatic: `disconnectedCallback()` calls `canvasManager.destroy()` when the element leaves the DOM.

> [!NOTE]
> Everything is shadow-DOM scoped — no global CSS required. Both palettes are `:host`-scoped CSS custom properties keyed off the `theme` attribute (see `theme.ts`); override the custom properties on `pixel-draw-panel` from outside if you need a different palette than the two built in.

## Sub-elements

Also exported from `@jolly-pixel/editor.pixel-art`, in case you want to compose your own layout instead of the full panel: `ModeRail` (`<mode-rail>`), `ColorPickerRail` (`<color-picker-rail>`), `ColorSwatch` (`<color-swatch>`, wraps `vanilla-picker`). They're fully controlled (props in, events out) — see `PixelDrawPanel.ts` for how they're wired together.

> [!IMPORTANT]
> `lit` and `vanilla-picker` are real `dependencies` of this package (not dev-only) — they ship at runtime for anyone importing it.
