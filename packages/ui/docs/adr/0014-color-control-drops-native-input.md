---
status: accepted
---

# `jolly-color` drops `input[type="color"]`

The native colour input cannot express alpha, ignores every theme token, and forced a second code
path for any editor wanting a themed picker. The row is now a swatch button opening
`jolly-color-picker`, the one control that is a panel rather than a row. The accepted loss is the OS
picker's eyedropper and system palettes.

Values stay hex strings, `#rrggbb` or `#rrggbbaa` when `alpha` is set, which keeps
`FieldValue<string>` and therefore `Mixed`, `default` and revert unchanged, and stays directly usable
as a CSS value. The panel holds an HSVA tuple as draft state, kept whenever it still formats to the
incoming value and re-derived otherwise.

Anchored placement, repositioning, focus restoration and the Escape hook live in a reusable
`PopoverController` over a native `popover`, not inside `jolly-color`.

## Considered Options

- **A structured `{ r, g, b, a }` value.** Breaks `FieldValue<string>`, needs a `hasChanged`
  comparator, and makes consumers format before painting.
- **A hex string plus a separate `alpha` property.** One drag of the alpha track emits changes for
  two properties, so a consumer reconciles two events per gesture.
- **Deriving picker handles from `value` alone.** Hue is unrepresentable at black, white and grey, so
  the hue handle snaps to red whenever the cursor enters a corner.
- **Holding HSVA as permanent canonical state.** Two rows bound to one colour drift apart, since
  neither ever re-reads the value.
- **`jolly-floating` as the popup.** It is a draggable, persisted, viewport-fixed panel that expects
  a nested Pane, not an anchored popup.
- **An absolutely positioned panel in the shadow root.** Clipped by any scrolling ancestor, and
  colour rows live inside scrolling docks.
- **CSS anchor positioning.** Firefox does not implement it, so placement stays in JS.
- **Placement inside `jolly-color`.** An editor wanting a brush swatch with no property row would
  reimplement anchoring, Escape and focus restoration.
