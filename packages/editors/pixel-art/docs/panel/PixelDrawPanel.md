# PixelDrawPanel

Drop-in web component with a mode rail, color controls, canvas and floating toolbars wired to a `PixelArtCanvas`. Undo, redo, import, export and transparent-texture reset remain visible at the bottom. Resetting the texture requires confirmation. UV and Select actions appear at the top in their respective modes.

The mode rail carries Move, Paint, Erase, Fill, Select and UV (hidden unless [`uv-access`](#uv-access) is `edit`). Erase runs the brush against transparency, so the brush size slider stays available there and both mouse buttons erase.

The UV toolbar includes independent toggles for region labels and showing every region. Labels display `(name)` or `(id)` inside a stacked UV, with the face on a second line once the region has per-face cells. Show All does not change the label preference.

With a region selected, the toolbar also shows a state dropdown. Its trigger carries the current state; opening it lists the two states the region is not in, and picking one calls `UVMap.setState()`. The parts are `uv-state-button` and `uv-state-menu`, plus `uv-stacked-button`, `uv-unfolded-button` and `uv-free-button` for the options. Next to it, `uv-rotate-ccw-button` and `uv-rotate-cw-button` call `UVMap.rotate()` on the selected region, or on the selected slot of a free region.

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

`initialize(options?)` takes the same `PixelArtCanvasOptions` as `new PixelArtCanvas(...)` (see [PixelArtCanvas.md](../../../../pixel-draw-renderer/docs/PixelArtCanvas.md)), plus optional `id` (default `"default"`), `name` (default `"Texture"`) and `tooltip` for the first texture, and resolves with the created instance. Must `await` it: the canvas host div only exists after Lit's first render. Calling it again destroys every open texture first.

A host that manages several textures from the start calls `configure(options?)` instead, then `addTexture()` for each one:

```ts
await panel.configure({ zoom: { max: 32 } });
for (const texture of textures) {
  panel.addTexture(texture, { activate: false });
}
panel.activeTextureId = textures[0].id;
```

The first texture added is always activated.

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

The small button under the swatches toggles a docked picker: a 140px strip under the stage with a saturation and value area, vertical hue and alpha tracks, R/G/B, H/S/L and A fields, and a hex field. The strip slides up from the bottom while the stage shrinks to make room, and the canvas resizes itself. The `color-dock` part stays in the DOM when closed; it is hidden and `inert`.

While docked there is one active color. Every change, including an eyedropper pick with either mouse button, writes it to both `brush.primary` and `brush.secondary`, so both mouse buttons paint it. The rail folds down to one swatch that shows it and is disabled, and the swap button is hidden. Undocking restores the background color held before docking.

Docking reads the current brush colors first, so colors set through `canvasManager.brush` are picked up. The swatches and the docked picker read the brush whenever the panel renders, so a direct brush write shows up on the next panel update. The panel does not persist the docked state; hosts store `colorDocked` themselves.

## Normal map

The `normal-map` attribute turns on the [normal map](../../../../pixel-draw-renderer/docs/normal/NormalMap.md) controls. It is off by default. Turn it on only where the document format stores normal map settings.

| Control | Where | What it does |
|---|---|---|
| `Albedo | Normal` (`texture-view-switch`) | Bottom toolbar, trailing | Sets the active canvas's [`textureView`](../../../../pixel-draw-renderer/docs/PixelArtCanvas.md#textureview--pixelsreadonly--unavailablemodes). Each texture keeps its own view. Not saved, not synced. |
| Normal map settings (`normal-map-dock-button`) | Bottom toolbar, trailing | Toggles the normal map dock. Switching to the Normal view opens it. |
| Export normal map (`export-normal-button`) | Bottom toolbar, after Export | Downloads `texture.normal.png` in the OpenGL convention (as stored) or DirectX (green inverted). Enabled only while the texture has normal map settings. |
| Override normal map (`uv-override-normal-button`) | UV toolbar | Adds a zone for the selected UV region and opens the dock. Disabled while the texture has no normal map settings. |

The Normal view is read-only for pixels: Paint, Erase and Fill are disabled in the mode rail (switching to Normal from one of them selects Move, and switching back restores it), a selection cannot move or change pixels, and Import, Clear texture and texture drop are disabled. Move, Select and UV work as usual.

The dock (`part="normal-map-dock"`, a `<normal-map-dock>`) is a 220px strip under the stage, like the color picker dock. Both docks share one slot (`part="dock-slot"`), so only one is open at a time: opening one closes the other, and the slot resizes between them without showing both.

- **Normal map**, at the top of the zones column: creates the settings with the defaults, or removes them. While it is off, the dock shows only the toggle and a short description. Notes carry an info icon, and zone warnings a warning icon.
- **Zones**: *Texture defaults*, then one row per zone with the region colour and name. A zone whose UV region is missing is struck through. A zone that loses to a newer zone on shared pixels says which regions it shares them with. Each zone has a delete button. Selecting a row selects its UV region; selecting a UV region that has a zone selects its row.
- **Settings**: the fields of the selected row. On a zone, a field that is not overridden reads muted and shows the texture default; editing it overrides it, and the reset button returns it to the default. **Off for this UV** flattens every island the region touches. A note tells when `border: "wrap"` falls back to `"clamp"`.

Sliders preview while dragged through `normals.preview()` and record one history entry on release.

## Select toolbar and clipboard

Select mode shows Copy, Paste, Rotate Clockwise, Flip Horizontal, Flip Vertical and Delete. Paste stays enabled without a selection. Other actions enable after a completed rectangle, shape or paste. Clipboard failures appear beside the toolbar in a polite live region and clear automatically or when Select mode exits.

Copy uses PNG plus optional JollyPixel selection metadata, which carries raw RGBA so a JollyPixel-to-JollyPixel round trip is exact. External PNG, JPEG, WebP and GIF clipboard images appear as pixel-sharp floating selections and switch the mode rail to Select. They land centered on the texture cursor, or on the center of the visible view when the pointer is off the texture, pulled inside the texture bounds either way. Deselecting a floating paste deposits it; Delete cancels it. Plain HTTP or denied clipboard access falls back to the renderer's internal clipboard.

## Texture drop

Drag one local PNG, JPEG, WebP or GIF over the rendered texture rectangle to show the dashed drop overlay. The surrounding stage, mode rail and toolbars are not drop targets. What a valid drop does follows [`texture-import-policy`](#texture-import-policy); a replacement goes through normal history and synchronization, centers the texture and preserves the current drawing mode. Multiple files, directories, URLs, SVG and invalid or oversized images leave the texture unchanged.

The Import button goes through the same checks. Both report failures and a successful replacement in a polite live region (`part="drop-status"`).

## Multiple textures

The panel holds one or more textures, each backed by its own `PixelArtCanvas` with its own pixels, undo history, UV regions, selection and camera. The mode rail, colors and toolbars are shared: mode, brush size, colors and fill and select variants carry over when switching textures.

With one texture the panel looks as it always has, unless `texture-tabs="always"` keeps the strip up. With two or more, a tab strip (`part="texture-tabs"`, built on `jolly-tabs`) appears above the stage, showing each texture name; the canvas resizes itself when the strip appears or disappears. Clicking a tab or using the arrow keys switches texture; the close button and a middle click raise `texture-close-request`.

The host owns the texture list. The panel never creates or removes a texture on its own; it raises requests and the host answers with `addTexture()` and `removeTexture()`.

```ts
panel.textureImportPolicy = "ask";

panel.addEventListener("texture-add-request", (event) => {
  const { name, source } = event.detail;

  event.detail.respondWith(addTexture());

  async function addTexture() {
    const id = await createAsset(name, source);
    panel.addTexture({
      id,
      name,
      texture: {
        size: { x: source.width, y: source.height },
        init: source
      }
    });
  }
});

panel.addEventListener("texture-close-request", (event) => {
  panel.removeTexture(event.detail.id);
});
```

### Host-managed tabs

A host that manages textures itself, such as the voxel-map tilesets, turns the strip into its texture manager:

```ts
panel.textureTabs = "always";
panel.texturesAddable = true;
panel.texturesEditable = true;

panel.addEventListener("texture-create-request", () => openCreateDialog());
panel.addEventListener("texture-edit-request", (event) => {
  openEditDialog(event.detail.id);
});

panel.updateTexture(id, { badge: "12" });
```

The add button sits after the tabs and stays visible when they overflow. The edit button shows on the active tab. `badge` is an opaque string, the panel gives it no meaning. A `disabled` texture keeps its tab and its edit button but never becomes active, for an entry the host can describe but not open.

`addTexture(options)` merges `options` over the options given to `configure()` or `initialize()`, one top-level key at a time, so pass `texture` to avoid inheriting the first texture's size and `init`. Callbacks such as `onHistoryChange` stay bound to the canvas they were passed for. The panel's own toolbars only follow the active canvas.

### texture-import-policy

| Value | Import button and drop |
|---|---|
| `replace` (default) | Replace the active texture. No dialog. |
| `add` | Emit `texture-add-request`. |
| `ask` | Open a dialog: Replace current, Add as new, or Cancel. A "UV size of a new texture" select (`part="import-uv-size"`) offers 16 to 256 px, 16 by default; sizes larger than the image are disabled, and the select is left out when the image is smaller than 16 px. |

Paste is not affected: it always floats a selection into the active texture. The drop overlay reads "Drop image to replace texture", "Drop image to add texture" or "Drop image" according to the policy.

## Import progress

Importing an image is not instant: the file has to be decoded, and when the
policy adds a texture the host usually has to reach a server before
`addTexture()` can be called. The panel reports both.

While either is in flight, a scrim (`part="stage-busy"`) covers the stage with a
`jolly-spinner` and a label, blocking drawing on a canvas that is about to
change; an import started from the toolbar also turns its Import button into a
spinner and disables it. The scrim waits 150ms before painting, so a small image
never flashes it.

The panel knows when the decode ends. It cannot know when the host is done, so
`texture-add-request` carries `respondWith(work: Promise<unknown>)`: pass the
promise covering the whole add and the indicator stays up until it settles,
resolved or rejected. A host that never calls `respondWith` clears the indicator
as soon as the event has been dispatched.

## Keyboard shortcuts

The panel owns its keyboard. While the pointer is over the drawing canvas, it
runs the shortcuts of `keyBindings` on the active texture's
[`canvas.shortcuts`](../../../../pixel-draw-renderer/docs/input/CanvasShortcuts.md):

| Action | Default |
|---|---|
| `copy` / `paste` | `Mod+c` / `Mod+v` |
| `undo` | `Mod+z` |
| `redo` | `Mod+y` or `Mod+Shift+z` |
| `delete` | `Delete` |
| `rotate` / `rotateCounterClockwise` | `r` / `Shift+r` |
| `flipHorizontal` / `flipVertical` | `h` / `v` |

Letters follow the printed key, so `Mod+z` stays Ctrl+Z on AZERTY. Space holds
the pan modifier and Shift the line modifier; neither can be rebound. Keys typed
in a text field, and keys claimed by an open dialog or popover (`inputLayers`
from `@jolly-pixel/ui`), are ignored. The panel keeps the browser default of
every key it does not handle.

```ts
import { KeyBindingMap } from "@jolly-pixel/controls";
import { PIXEL_ART_KEY_BINDINGS } from "@jolly-pixel/editor.pixel-art";

panel.keyBindings = new KeyBindingMap(PIXEL_ART_KEY_BINDINGS, {
  undo: "Mod+u"
});
```

`PIXEL_ART_KEY_BINDINGS` holds the defaults and `PixelArtAction` the action
names; the map lists them in `keyBindings.actions`. To persist user overrides, see
[KeyBindingSettings](../keybindings/KeyBindingSettings.md). For the map itself,
see [KeyBindingMap](../../../../controls/docs/key-binding-map.md).

## API

| Member | What it does |
|---|---|
| `initialize(options?)` | `configure(options)`, then creates the first texture and returns its `PixelArtCanvas`. Call once. |
| `configure(options?)` | Sets the `PixelArtCanvasOptions` every `addTexture()` starts from, without creating a texture. |
| `canvasManager` | The active texture's `PixelArtCanvas`, or `null` before the first texture. |
| `keyBindings` | The `KeyBindingMap<PixelArtAction>` the panel runs. Setting it replaces every shortcut at once. See [Keyboard shortcuts](#keyboard-shortcuts). |
| `addTexture(options, { activate? })` | Creates a texture from `{ id, name, tooltip?, badge?, disabled?, ...PixelArtCanvasOptions }` and returns its canvas. It becomes active unless it is `disabled`, or `activate` is `false` and another texture is active. Throws before `configure()` or for a duplicate `id`. |
| `removeTexture(id)` | Destroys a texture. Removing the active one activates its right neighbour, or its left one when it was last. Throws for an unknown id or the last texture. |
| `renameTexture(id, name)` | Updates a tab label. Names need not be unique. |
| `updateTexture(id, { name?, tooltip?, badge? })` | Updates the tab label, tooltip and badge; omitted keys are kept, an empty `badge` removes it. |
| `textures` | `{ id, name, tooltip, badge, disabled, canvas }[]` in tab order. |
| `activeTextureId` | The active texture id, or `null` before the first texture. Setting it switches texture; unknown ids throw. |
| `texture-import-policy` attribute / `textureImportPolicy` property (`"replace" | "add" | "ask"`, default `"replace"`) | See [texture-import-policy](#texture-import-policy). Reflects to the attribute; unknown values fall back to `"replace"`. |
| `texture-change` event | `detail: { id, source }`. Fires whenever the active texture changes from one texture to another, so not for the first texture. `source` is `"user"` for a tab click and `"api"` for `activeTextureId`, `addTexture()` or removing the active texture. |
| `texture-add-request` event | `detail: { name, source, origin, uvSize, respondWith }`. `name` is the file name without its extension, `source` the decoded `HTMLCanvasElement`, `origin` is `"import"` or `"drop"`. `uvSize` is the UV size picked in the `ask` dialog, `null` when no dialog was shown or it had no select; the host decides what to do with it, such as creating a starter UV region. See [Import progress](#import-progress) for `respondWith`. |
| `texture-close-request` event | `detail: { id }`. Fires from a tab close button or middle click. |
| `texture-create-request` event | No detail. Fires from the add button. Distinct from `texture-add-request`, which carries an imported image. |
| `texture-edit-request` event | `detail: { id }`. Fires from a tab edit button and does not switch texture. |
| `texture-tabs` attribute / `textureTabs` property (`"auto" | "always"`, default `"auto"`) | `auto` shows the strip from two textures, `always` from the first. Unknown values fall back to `"auto"`. |
| `textures-addable` attribute / `texturesAddable` property | Shows the add button after the tabs. Off by default. |
| `texture-tabs-variant` attribute / `textureTabsVariant` property (`"default" \| "skew"`, default `"default"`) | Look of the tab strip, passed to `jolly-tabs`. `skew` drops the full-width strip background and chains the tabs and the add button as parallelograms. |
| `texture-add-label` attribute / `textureAddLabel` property (default `"Add texture"`) | Accessible name and tooltip of the add button, for a host with its own word for a texture. |
| `textures-editable` attribute / `texturesEditable` property | Shows an edit button in the active tab and in disabled tabs. Off by default. |
| `textures-closable` attribute / `texturesClosable` property | Shows the tab close buttons. On by default; turn it off when the host does not let the user close textures. |
| `onResize()` | Resizes the active canvas to its host box. The panel already observes that box itself (its own layout changes, such as the texture tabs appearing, are covered); call it for outer resizes an observer misses, such as a split-pane drag that only repaints on drag end. |
| `allow-uv-create-delete` attribute / `allowUvCreateDelete` property | Shows the Create/Delete buttons in the UV toolbar. Off by default: creating/deleting regions only makes sense when the panel owns the UV layout (the package's own example); embeddings over a fixed mesh (e.g. voxel-map) leave it off. |
| `uv-access` attribute / `uvAccess` property (`"edit" \| "view" \| "none"`, default `"edit"`) | Exposes UV editing, visibility toggles only, or nothing. See [UV access](#uv-access). Reflects to the attribute; unknown values fall back to `"edit"`. |
| `color-docked` attribute / `colorDocked` property | Opens the docked color picker. Off by default. Reflects to the attribute. |
| `color-docked-change` event | Fires when the user toggles the docked picker; `detail` is the new `boolean`. |
| `normal-map` attribute / `normalMap` property | Shows the normal map controls. Off by default. Turning it off switches every texture back to the Albedo view. See [Normal map](#normal-map). |
| `theme` attribute / property (`"light" \| "dark" \| "auto"`, default `"auto"`) | Selects the palette. `"auto"` follows the theme scope the panel is embedded in (`jolly-scope`, or any themed ancestor), falling back to `prefers-color-scheme` when there is none; `"light"`/`"dark"` force one regardless. Reflects to the attribute. |
| `resolvedTheme` | The palette in use, `"light"` or `"dark"`: `theme`, or what `"auto"` resolves to. |
| `theme-change` event | `detail` is the new `resolvedTheme`. Fires when `theme` changes, and when `prefers-color-scheme` changes under `"auto"`. |
| `canvas-hover-change` event | `detail: { hovering }`. Fires when the pointer enters or leaves the drawing canvas, for hosts that suspend their own keyboard meanwhile. The name is exported as `CANVAS_HOVER_CHANGE_EVENT`. |

Destruction is automatic: `disconnectedCallback()` destroys every texture canvas when the element leaves the DOM.

> [!NOTE]
> Everything is shadow-DOM scoped — no global CSS required. Both palettes are `:host`-scoped CSS custom properties keyed off the `theme` attribute (see `theme.ts`); override the custom properties on `pixel-draw-panel` from outside if you need a different palette than the two built in.

## Sub-elements

Also exported from `@jolly-pixel/editor.pixel-art`, in case you want to compose your own layout instead of the full panel: `ModeRail` (`<mode-rail>`, with `mode`, `options`, `uvAccess` and `unavailableModes` properties, the last one a `ReadonlySet<Mode>` of modes to disable, such as `PixelArtCanvas.unavailableModes`; it emits `mode-change` with a `Mode` and `tool-option-change` with a `ToolOption` `{ name, value }`, where `name` is `pickColor`, `fillGlobal`, `fillUvClip` or `selectShape`), `ColorPickerRail` (`<color-picker-rail>`, with a `docked` property and a `dock-toggle` event), `ColorSwatch` (`<color-swatch>`, wraps `jolly-color-picker` in a popover, with a `disabled` property), `ColorDock` (`<color-dock>`, a wide `jolly-color-picker` that emits `color-change`) and `NormalMapDock` (`<normal-map-dock>`, which edits the normal map settings of its `pixelDocument` directly and renders only while its `open` property is set). They're fully controlled (props in, events out) — see `PixelDrawPanel.ts` for how they're wired together.

> [!IMPORTANT]
> `lit` and `@jolly-pixel/ui` are real `dependencies` of this package (not dev-only) — they ship at runtime for anyone importing it.
