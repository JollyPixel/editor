# Keybinds

Every map shortcut is an action with default [key chords](../../../controls/docs/key-chords.md).
The code lives in `src/keybindings/`. A lowercase letter follows the printed key, so `r` stays
on R with AZERTY. A code such as `KeyQ` follows the key position.

## Actions

`tool`:

- `tool.brush`: `b`, picks the brush.
- `tool.select`: `m`, picks selection, then switches between box and connected select.

`edit`:

- `edit.undo`: `Mod+z`. `edit.redo`: `Mod+y`, `Mod+Shift+z`.
- `edit.copy`: `Mod+c`, copies what floats.
- `edit.cut`: `Mod+x`, copies a lifted region, then deletes it.
- `edit.paste`: `Mod+v`, pastes at the aimed cell.
- `edit.delete`: `Delete`, `Backspace`, deletes a lifted region.
- `edit.selectLayer`: `Mod+a`, lifts the whole selected voxel layer with the select tool.

`brush`, only while a voxel layer is selected:

- `brush.mode`: `r`. `brush.pattern`: `c`. `brush.ghost`: `g`.
- `brush.shrink`: `BracketLeft`. `brush.grow`: `BracketRight`. Both repeat while held.

`orient` turns the pending placement when there is one, and the brush otherwise:

- `orient.rotateCounterClockwise`: `KeyQ`. `orient.rotateClockwise`: `KeyE`. With rotation on
  `auto`, the first press starts from the rotation the preview shows, then fixes it.
- `orient.flipVertical`: `v`, toggles the brush Flip Y, or mirrors the placement along Y.
- `orient.mirrorHorizontal`: `h`, placement only. It mirrors along X or Z, whichever is closer
  to the camera's left-right direction.
- `orient.autoRotation`: `t`, puts the brush rotation back on `auto`.

`view`:

- `view.frame`: `f`, frames the selected layer or object, like its Frame menu item, or every
  visible voxel layer without a selection.
- `view.grid`, `view.glow`, `view.chunkBounds`: toggle that view setting. Unbound.
- `view.inspector`: steps through `off`, `overlay` and `wireframe`. Unbound.

`Enter` commits a placement and `Escape` cancels it, leaves the camera pivot, then leaves the
select tool. These two keys cannot be rebound.

## Console

Each action is a `string[]` variable named after it under `keybinds`:

```txt
keybinds.orient.rotateClockwise          prints KeyE
keybinds.view.grid Digit1                binds the grid toggle
keybinds.brush.ghost ""                  unbinds the ghost toggle
/keybinds.reset orient.rotateClockwise   restores one default
/keybinds.reset                          restores every default
```

A chord that another action already uses is refused with an error, and nothing changes.

Changes are saved in the browser under `voxel-map:keybindings`, as the difference from the
defaults. An entry that no longer parses is dropped at load and logged.

The texture panel keeps its own shortcuts under `pixelart.keybinds`.
