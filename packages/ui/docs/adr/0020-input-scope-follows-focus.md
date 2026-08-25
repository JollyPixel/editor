---
status: accepted
---

# Input scope follows focus, and is fixed in both `engine` and `ui`

A UI control and a running 3D viewport share one keyboard, and today they collide: `engine`'s
`Keyboard` attaches to `document`, inspects no target, and calls `preventDefault()` on 33 keys
including `Tab` and `Escape`. Exactly one scope owns the keyboard at a time, and ownership follows
focus, never hover.

The fix is split across both packages because neither half is sufficient alone:

- `engine` ignores key events whose target is editable (an exported `isEditableTarget`, resolved
  through `composedPath()`), and stops preventing `Tab` and `Escape`.
- `ui` tracks `focusin`/`focusout` on its own roots and publishes an `InputScopeSource`, taking no
  dependency on `engine`. The editor wires the two together in one line.

Focus detection must use `composedPath()`, since events crossing a shadow boundary are retargeted to
the host and `document.activeElement` reports `jolly-pane`.

## Considered Options

- **Gating on hover**, as voxel-map does today. Moving the pointer away mid-sentence re-arms the
  engine under the user, and it exists in one editor of three.
- **Fixing it in `ui` alone.** `Tab` stays prevented while the viewport has focus, so the keyboard can
  never reach the UI in the first place.
- **Fixing it in `engine` alone.** A focused rail button or tree node is not editable, so keys still
  reach the viewport.
- **Guarding `keyup` alongside `keydown`.** Hold `W` on the canvas, `Tab` into a field, release: the
  guard swallows the `keyup`, `KeyW` stays held, and the camera drifts forever. Deleting a key that
  was never added is a harmless no-op, so the asymmetry is load-bearing.

## Consequences

Removing `Tab` and `Escape` from the prevented set is a behaviour change to a published package: a
fullscreen canvas now loses focus on `Tab`. The events still emit, so the opt-out is one line
(`keyboard.on("Tab", (event) => event.preventDefault())`), which the changeset documents.

`Escape` is removed rather than merely reconsidered, because native `dialog`'s Escape-to-close is a
browser default action: with it still prevented, `jolly-dialog` closes in the examples gallery and
silently fails in every editor.
