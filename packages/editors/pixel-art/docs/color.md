# Color controls

`PixelDrawPanel` owns one `ColorPickerPopover` shared by foreground,
background and all ten palette slots. The docked picker is a separate inline
control. The shared popover has an opaque background, reanchors for each
request and restores focus when dismissed. Palette selection and keyboard
focus use inset highlights that stay within each swatch.

## Custom layouts

`ColorSwatch` exposes `color`, `opacity`, `disabled`, `setColor(hex, opacity)`
and `close()`. It emits `color-picker-open` with a `ColorPickerRequest` and
`color-picker-close` with its button anchor. Wire these events to one shared
`ColorPickerPopover.open(request)` and `close(anchor)`. Committed and preview
brush changes both emit `color-change` with `{ hex, opacity }`.

A `ColorPickerRequest` contains an `anchor`, `label`, placement `side`,
`color()` reader, `change(color, last)` callback and `close()` callback. Call
`refresh()` after external color changes; it refreshes the displayed value
when no local picker draft is active. Close the popover when its target goes
away, for example on a texture switch.

`ColorPaletteGrid` receives `palette`, `selected`, `editing` (the slot whose
picker is open, or `null`) and `disabled`. It emits `palette-select` with a
zero-based index, and `palette-edit` with `{ index, anchor }` on double click
or F2. The host opens the shared picker for an edit request.

`ColorDock` receives `color`, `opacity`, `palette`, `selected` and
`editing`. A `null` palette disables the grid. Inline picker drafts emit
`color-preview`; completed adjustments emit `color-change`. The full panel
commits palette colors through `PixelDocument.changePaletteColor` and retains
the selected slot locally. Toggling Pick color retains the selected slot. Other
clicks outside the canvas and color controls clear the slot selection while
retaining the brush color. Selection changes never create history or network
commands.
