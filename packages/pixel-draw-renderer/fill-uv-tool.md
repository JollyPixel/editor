# Fill UV Tool

Fill sometimes needs to stay inside one UV slot, and sometimes needs to cover everything that no slot uses. This spec adds a UV clip option to the existing Fill tool and gives Clear texture a way to keep slot pixels.

The wording follows `GLOSSARY.md`: a region maps to one or more **slots**. The code still has older `face` names (`activeFaces`, `stackedFace`); new code, docs and UI copy say slot.

## Fill with UV clip

### Behavior

UV clip is an option on Fill, next to `global`. It is not a separate mode, rail button or keybinding.

- Seed pixel inside one or more slots: the fill stays inside the union of every slot that contains the seed.
- Seed pixel outside every slot: the fill stays outside all slots. Gaps between the slots of an unfolded net count as outside.
- No regions: the result is identical to a plain fill.

The clip narrows the normal fill. It does not replace it. Flood fill still uses four-connectivity and matches the seed color, and the slot mask acts as a wall. With `global` on, every pixel matching the seed color inside the mask is recolored. A fill that ignores existing colors and paints the whole slot is out of scope; if it is ever needed, it belongs in the UV panel as its own action.

### Slot mask

`uvSlotMask()` builds one `Uint8Array(width * height)` per fill, so the flood loop reads one extra byte per pixel.

- A pixel belongs to a slot when its center `(x + 0.5, y + 0.5)` passes `pointInGeometry`. `PixelArtCanvas.hasTransparency` already uses this rule, so both features agree on slot membership.
- Geometry is exact. Triangles clip on the diagonal and compound parts are respected. Pixels whose center sits on a triangle diagonal belong to the triangle, so two complementary triangles both claim that row.
- Slots come from `region.slotsOf()`: the single rect of a stacked region, or the active slots of an unfolded or free region. Inactive slots do not clip.
- Every region counts, whatever `UVMap.isVisible()` says. `showAll` and the selection are local view state; fills are synchronized edits and must produce the same pixels for every peer.

### Sync and history

A clipped flood fill commits positions through `commitPixels`, like the current flood fill.

A clipped global fill must not emit `global-fill`. Receivers of that event (`EditPipeline` for peers, `PixelCommandApplier` on the asset server) run `Fill.matchAll` on their own buffer and would recolor the whole texture. It is committed as a `stroke` with its positions and `toColor` instead. Only an unclipped global fill keeps emitting `global-fill`. The command schema and the server stay unchanged.

### API

```ts
interface FillTool {
  global: boolean;
  uvClip: boolean; // default false
}
```

### Pixel-art UI

The `ModeRail` fill flyout keeps the Neighbor/Global swap and gains a "Clip to UV" toggle button with `aria-pressed` and an active style. While the clip is on, the rail fill icon shows a small UV badge. The toggle is always shown, including when the texture has no regions, so it does not appear and disappear as regions are created.

Wiring mirrors `fillGlobal`: `ToolOptionsController.setFillUvClip()` and `ModeRail.fillUvClip`.

## Clear texture

### Behavior

Clearing only touches pixels. UV regions are never deleted; that stays an action of the UV panel.

- By default, pixels outside every slot become transparent and slot pixels are kept.
- With the option checked, every pixel becomes transparent.

The mask is the same one Fill uses: all regions, active slots, pixel centers.

### API

```ts
PixelArtCanvas.clearTexture(options?: { includeUV?: boolean }): void;
```

`includeUV` defaults to `false`, so a bare `clearTexture()` matches the dialog default. The call goes through the `EditPipeline.replaceTexture` commit path: one `texture-replaced` history entry and one `texture-replaced` hook event. A `stroke` with a position list was rejected because on large textures it costs about 15 bytes of JSON per position against 4 bytes per pixel, and undo would carry a `beforeColors` entry for every pixel.

Keeping the mask in the renderer means the voxel-map texture editor, which embeds `<pixel-draw-panel>`, gets the same behavior.

### Pixel-art dialog

`HistoryFileToolbarController.clearTexture()` opens a local `showClearTextureDialog(): Promise<{ includeUV: boolean } | null>` built from `Dialog`, `Checkbox` and two buttons. `showConfirm` in `@jolly-pixel/ui` only resolves to a boolean, and one caller does not justify a new ui helper. If a second caller shows up, the helper moves to ui.

| Element | Copy |
|---|---|
| Title | Clear texture |
| Message | Make the texture transparent? Pixels inside UV slots are kept unless the option below is checked. |
| Checkbox | Also clear pixels inside UV slots (unchecked) |
| Confirm | Clear (danger) |

When the texture has no regions the checkbox is hidden, since both states would clear the same pixels, and the message falls back to the current one: "Clear the entire texture and make every pixel transparent?"

## Validation

### `@jolly-pixel/pixel-draw.renderer`

- `test/uv/uvSlotMask.spec.ts`: rect slot, triangle diagonal, compound parts, stacked versus unfolded, inactive slots excluded, hidden regions included.
- `test/PixelArtCanvas.fill.spec.ts`:
  - seed inside a slot: the slot edge stops a same-color flood;
  - seed outside: slots are skipped and net gaps are filled;
  - overlapping slots fill as a union;
  - clipped global fill emits `stroke`, never `global-fill`;
  - undo restores the clipped fill;
  - no regions matches a plain fill.
- `clearTexture()`: the default keeps slot pixels, `includeUV: true` clears everything, one history entry, one `texture-replaced` hook event.
- Docs: `docs/tools/FillTool.md` (`uvClip`), `docs/PixelArtCanvas.md` (`clearTexture`), and a **UV Clip** entry in `GLOSSARY.md`.
- One minor changeset, two or three lines.

### `@jolly-pixel/editor.pixel-art`

Private workspace, so no changeset. The rail and the dialog are DOM-heavy, so coverage is Playwright only:

- `test/e2e/fill.e2e.ts`: toggle "Clip to UV" from the flyout, fill inside and outside a created region.
- Clear dialog in `io.e2e.ts` or `history.e2e.ts`: checkbox off, checkbox on, checkbox hidden without regions.

### `@jolly-pixel/asset.pixel-art`

No change. Clipped fills arrive as `stroke` and clears as `texture-replaced`, both already handled by `PixelCommandApplier`.
