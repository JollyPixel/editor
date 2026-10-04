# UI components

The package root registers `<pixel-draw-panel>` and exports the panel class and
controlled subcomponents. Import the package for registration, then initialize
a panel after it has been connected to the DOM:

```ts
import "@jolly-pixel/editor.pixel-art";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";

const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
const canvas = await panel.initialize({
  texture: { size: { x: 64, y: 64 } },
  defaultMode: "paint"
});
```

```html
<pixel-draw-panel style="width: 640px; height: 480px"></pixel-draw-panel>
```

`initialize()` configures and creates the initial texture. For a host that owns
a texture list, call `configure()` once and add canvases with `addTexture()`.
Each texture has its own `PixelArtCanvas`, pixels, history, UV map and viewport;
the active canvas is available as `panel.canvasManager`.

```ts
await panel.configure({ zoom: { max: 32 } });
panel.addTexture({ id: "body", name: "Body", texture: { size: { x: 64, y: 64 } } });
panel.addTexture({ id: "trim", name: "Trim", texture: { size: { x: 32, y: 32 } } });
panel.activeTextureId = "body";
```

The host owns texture creation and removal. `texture-create-request`,
`texture-add-request`, `texture-edit-request` and `texture-close-request` are
requests; handle them and call the corresponding panel methods. See
[`PixelDrawPanel` API](./panel/PixelDrawPanel.md) for signatures and event
payloads.

## UV access

`uv-access` controls the panel's UV tools:

| Value | Behavior |
|---|---|
| `edit` | UV mode and its editing toolbar are available (default). |
| `view` | UV editing is hidden; visibility controls and fill clipping remain. |
| `none` | UV controls and fill clipping are hidden; clipping is disabled. |

Region overlays still follow `UVMap.isVisible()` in every mode. Use `view` when
the host owns UV selection and `none` when the texture has no UV layout.

## Layout composition

The root exports `ModeRail`, `ColorPickerRail`, `ColorDock`, `ColorSwatch` and
`NormalMapDock` for custom layouts. They are controlled components: set their
properties and respond to their events. `PixelDrawPanel.ts` shows the wiring
used by the full panel. Their definitions and event types are in `src/`.

The package root also exports key-binding settings and defaults. See
[KeyBindingSettings](./keybindings/KeyBindingSettings.md).
