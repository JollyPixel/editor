# PixelDrawPanel

Drop-in web component with a mode rail, color controls, canvas and floating toolbars wired to a `PixelArtCanvas`. Undo, redo, import, export and transparent-texture reset remain visible at the bottom. Resetting the texture requires confirmation. UV and Select actions appear at the top in their respective modes.

The mode rail carries Move, Paint, Erase, Fill, Select and UV (hidden unless [`uv-access`](#uv-access) is `edit`). Erase runs the brush against transparency, so the brush size slider stays available there and both mouse buttons erase.

The UV toolbar includes independent toggles for region labels and showing every region. Labels display `(name)` or `(id)` inside a stacked UV, with the face on a second line once the region has per-face cells. Show All does not change the label preference.

With a region selected, the toolbar also shows a state dropdown. Its trigger carries the current state; opening it lists the two states the region is not in, and picking one calls `UVMap.setState()`. The parts are `uv-state-button` and `uv-state-menu`, plus `uv-stacked-button`, `uv-unfolded-button` and `uv-free-button` for the options.

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

## UV access

`uv-access` sets how much of the UV map the panel exposes. Region rendering does not depend on it: a region is drawn when [`UVMap.isVisible()`](../../../../pixel-draw-renderer/docs/uv/UVMap.md) is true, in every mode.

| Value | UV mode and toolbar | Labels and Show all | Fill "Clip to UV" |
|---|---|---|---|
| `edit` (default) | Shown | In the UV toolbar | Shown |
| `view` | Hidden | At the end of the bottom toolbar | Shown |
| `none` | Hidden | Hidden | Hidden and turned off |

Use `view` when the host drives region selection and users should only paint, and `none` for textures without UV regions. Leaving `edit` while in UV mode switches the panel to Paint, and `initialize()` does the same for `defaultMode: "uv"`. Setting `canvasManager.mode = "uv"` directly is not blocked, but no UV toolbar is shown outside `edit`.

```html
<pixel-draw-panel uv-access="view"></pixel-draw-panel>
```

## Docked color picker

The small button under the swatches toggles a docked picker: a 140px strip under the stage with a saturation and value area, vertical hue and alpha tracks, R/G/B, H/S/L and A fields, and a hex field. The stage shrinks to make room and the canvas resizes itself.

While docked there is one active color. Every change, including an eyedropper pick with either mouse button, writes it to both `brush.primary` and `brush.secondary`, so both mouse buttons paint it. The swatches show it but are disabled, and swap does nothing. Undocking restores the background color held before docking.

Docking reads the current brush colors first, so colors set through `canvasManager.brush` are picked up. Direct brush writes made while docked are not reflected in the picker. The panel does not persist the docked state; hosts store `colorDocked` themselves.

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
| `uv-access` attribute / `uvAccess` property (`"edit" \| "view" \| "none"`, default `"edit"`) | Exposes UV editing, visibility toggles only, or nothing. See [UV access](#uv-access). Reflects to the attribute; unknown values fall back to `"edit"`. |
| `color-docked` attribute / `colorDocked` property | Opens the docked color picker. Off by default. Reflects to the attribute. |
| `color-docked-change` event | Fires when the user toggles the docked picker; `detail` is the new `boolean`. |
| `theme` attribute / property (`"light" \| "dark" \| "auto"`, default `"auto"`) | Selects the palette. `"auto"` follows the theme scope the panel is embedded in (`jolly-scope`, or any themed ancestor), falling back to `prefers-color-scheme` when there is none; `"light"`/`"dark"` force one regardless. Reflects to the attribute. |

Destruction is automatic: `disconnectedCallback()` calls `canvasManager.destroy()` when the element leaves the DOM.

> [!NOTE]
> Everything is shadow-DOM scoped — no global CSS required. Both palettes are `:host`-scoped CSS custom properties keyed off the `theme` attribute (see `theme.ts`); override the custom properties on `pixel-draw-panel` from outside if you need a different palette than the two built in.

## Sub-elements

Also exported from `@jolly-pixel/editor.pixel-art`, in case you want to compose your own layout instead of the full panel: `ModeRail` (`<mode-rail>`, with a `uvAccess` property), `ColorPickerRail` (`<color-picker-rail>`, with a `docked` property and a `dock-toggle` event), `ColorSwatch` (`<color-swatch>`, wraps `jolly-color-picker` in a popover, with a `disabled` property) and `ColorDock` (`<color-dock>`, a wide `jolly-color-picker` that emits `color-change`). They're fully controlled (props in, events out) — see `PixelDrawPanel.ts` for how they're wired together.

> [!IMPORTANT]
> `lit` and `@jolly-pixel/ui` are real `dependencies` of this package (not dev-only) — they ship at runtime for anyone importing it.
