# Color picker roadmap

Follow-up work for OKLCH and the Aseprite-style color picker, across
`@jolly-pixel/color`, `@jolly-pixel/ui`, `@jolly-pixel/editor.host`,
`@jolly-pixel/editor.pixel-art` and `@jolly-pixel/pixel-draw.renderer`.

The references were the Aseprite color bar tutorial
(https://www.aseprite.org/docs/tutorial/color-bar-tutorial/) and the Steam guide
on color mixing and perceptual models
(https://steamcommunity.com/sharedfiles/filedetails/?id=3048581678).

## What exists now

- `color`: OKLab/OKLCH conversions with CSS Color 4 gamut mapping, `oklch()`
  and `oklab()` parsing, `formatOklch`, OKHSV and OKHSL (ported from Björn
  Ottosson's `ok_color.h`), `mixColor`/`colorRamp` in srgb, linear, oklab or
  oklch with CSS hue arcs, and `colorHarmony` with seven kinds.
- `ui`: `jolly-color-picker` takes `space` (`hsv`, `okhsv`), `selector`
  (`square`, `wheel`), `discrete`, `channels` (`hsl`, `oklch`) and `harmony`.
  Pickers share one set of preferences, written by `ColorPicker.configure()`
  and by the `settings` button. `ColorPicker.follow()` hands that set to an
  application store. Values stay sRGB hex strings (ADR 0014).
- `editor.host`: the `color-picker` preference scope, built from
  `@jolly-pixel/ui/color-picker` and followed by every page, so a picker's
  settings write straight into it. Studio lists it under You.
- `pixel-art`: the dock and popover pickers show the settings button. A right
  click on a harmony swatch sets the background color, and Shift click on a
  palette slot fills an OKLab ramp from the selected slot as one undo step.

Defaults are still HSV and the square, so nothing changes for anyone who has
not opted in.

## Not done in this pass

### Selectors and spaces

- **OKHSL selector.** The conversions exist, but `space` only offers `hsv` and
  `okhsv`. An OKHSL square (saturation across, lightness up) is what the Steam
  guide recommends for hue-shifted shading.
- **Raw OKLCH plane.** A lightness by chroma plane at a fixed hue, with the
  gamut edge drawn. Useful to see where a hue runs out of chroma; OKHSV hides
  that by design.
- **Spectrum selector.** Aseprite's HSL band (hue across, lightness up, full
  saturation).
- **Tint, shade and tone triangle.** Aseprite's default HSV selector shape.
- **RYB wheel.** An artist hue remap (red, yellow, blue primaries). Needs a
  hue mapping table in `color` and a `space` or wheel option in `ui`.
- **Normal map wheel.** Azimuth around, inclination outward, color is
  `n * 0.5 + 0.5`. Only worth it if pixel-art grows hand painted normal maps;
  today `pixel-draw.renderer` generates them. Blending normals would need
  slerp, not a color mix.
- **Wheel at value 0.** The wheel paints at the current value, so it turns
  black at black. Aseprite keeps hues visible; an option to paint the wheel at
  full value and show value only on the track would help.
- **Harmony on the square.** Markers only appear on the wheel. The square
  could mark harmony hues on the hue track.

### Palette (pixel-art and pixel-draw.renderer)

- **Variable palette size.** `ColorPalette` holds exactly 10 `RGBA8` slots, and
  `PixelArtFile.palette` and the `palette-color-changed` command assume it.
  Aseprite lets the palette grow and shrink by dragging its end. No migration
  of old files is needed.
- **Ramp options.** The ramp always blends in OKLab. It should read a
  preference (`srgb`, `linear`, `oklab`, `oklch` with a hue arc for "gradient
  by hue"). It also needs a visible button: Shift click is only in the
  tooltip.
- **Shade ramp row.** A row of hue-shifted shades and tints of the active
  color (darker toward cool, lighter toward warm), generated in OKLCH. Needs a
  `shadeRamp` helper in `color`.
- **Palette tools from Aseprite.** Load and save (GPL, Lospec hex, ASE),
  presets, "new palette from texture", sort by hue, saturation, brightness,
  luminance, channel or alpha, drag to reorder, Ctrl drag to duplicate, `[`
  and `]` to step through slots.
- **Recent colors.** A short history row next to the palette.

### Mixing and painting

- **Mix dialog.** Two colors, a percentage and a space, like the Lua scripts
  in the Steam guide. `mixColor` already does the math.
- **Brush compositing.** A stroke writes the brush RGBA straight into the
  pixels (`PixelBuffer` replaces them), so a translucent brush never mixes
  with what is under it. Aseprite's alpha compositing and lock alpha inks are
  the model; blending in linear or OKLab would keep soft edges from going
  muddy.
- **Paint-like mixing.** Kubelka-Munk (Mixbox style) as another `MixSpace`.
- **Texture adjustments.** OKHSL contrast (`L' = (L - 0.5) * F + 0.5`) and hue
  shift toward a target, as filters on a selection.

### UI and preferences

- **`jolly-color` rows.** They forward the new properties but not `settings`.
  The row's picker lives in a popover; the settings view is inline so it
  should work, but nobody has checked it in a scrolling dock.
- **Eyedropper.** ADR 0014 gave up the OS eyedropper. The `EyeDropper` API
  (Chromium) could come back as a button in the footer where it exists.
- **Hue wrap on the wheel.** The keyboard hue axis stops at 360 instead of
  wrapping to 0.
- **Per-editor overrides.** The preference is one host scope for every
  editor. A voxel editor might want a different default than pixel-art.
- **Default space.** Revisit making OKHSV the default after feedback.
  Switching changes how every picker looks, so the pixel-art and voxel e2e
  suites that drag on the square would need a look.
- **Harmony right click outside pixel-art.** Voxel-map and voxel-model pickers
  emit `jolly-secondary` but nothing listens.

### Out of scope

- **Wide gamut and color profiles.** Aseprite's sprite profiles (assign or
  convert) and Display P3 need canvases created with `colorSpace:
  "display-p3"` and a storage format beyond 8-bit sRGB. Everything here
  stays sRGB.

## Known limits

- Gamut mapping follows CSS Color 4: chroma drops until clipping is under a
  just noticeable difference (0.02 in OKLab), then the color is clipped. The
  final clip can move hue by a few degrees near the gamut edge.
- OKHSV and OKHSL fit the gamut with Ottosson's approximation. Round trips
  drift by about 0.001 near the edge (h around 28 degrees at full saturation
  is the worst spot found), under one 8-bit step.
- Surfaces are painted on a 64 px canvas (160 px for the discrete wheel, with
  one conversion per cell). OKHSV costs about 0.75 µs per pixel, so a repaint
  takes about 3 ms. If dragging feels slow on low-end machines, cache the
  cusp per hue or paint in a fragment shader.
- The pixel-art ramp and harmony right click are covered by
  `ColorController` unit tests only; `palette.e2e.ts` has no case for them yet.
