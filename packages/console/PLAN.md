# `@jolly-pixel/console` build plan

The design is in [SPEC.md](./SPEC.md). This file is the order of work. Each phase ends with the
package's tests, `pnpm run typecheck` and `pnpm run lint` passing, and can be merged without the
next one.

## Done

P1 to P5 were built on 2026-09-30: the core entry (registry, input, execution, search, with a bench),
dismissible input layers in `ui` (ADR-0042, `ui` changeset), and the `jolly-console` element with its
example page and Playwright suite.

Changes to SPEC made while building them, to carry into the docs in P8:

- `registerVariable` is generic over the enum value type (`<const TValue extends string>`), not
  `<const TDef>`, so an enum setter narrows.
- Booleans also accept `yes`, `no`, `y`, `n`, `on` and `off`, like `yn`.
- Name matches rank above description matches, whatever the tier. Descriptions never match by
  scattered subsequence. An empty query returns nothing, so Up on an empty prompt recalls history.
- `unregister()` on the console itself clears every registration, built-ins included.
- `ArgDef` is a union on `type`, like `VariableDef`: an `enum` argument without `enumValues` and
  `rest` on a non-string argument are type errors, and still throw at registration.
- `RegisteredCommand.signal` aborts when the registration is removed or replaced. A run's
  `ctx.signal` follows it only while the run is pending.
- The console emits `registry-changed` and `scrollback-changed` instead of one `changed` event. The
  element refreshes its suggestions on `registry-changed`.
- The root entry exports `CommandConsole`, the registration types and the registration errors only.
  The parser, search and completion stay internal to the package.
- `jolly-console` adopts the ambient theme through `ui`'s `adoptAmbientTheme`.

Editors import `ui` from `dist/`. Rebuild `ui` before testing P6 and P7.

## P6. `editor.host` and voxel-map

Host: construct the `CommandConsole` in the runtime, expose it to editors, mount `jolly-console`, and
register the root `theme` variable. Read `packages/editors/host/AGENTS.md` if present.

Voxel-map: a `features/` module that registers the seven `brush` variables of SPEC section 10 and
unregisters the namespace on teardown. Enum values come from the store's own unions so they cannot
drift.

Tests: a unit spec with a real `BrushStore` and a real `CommandConsole`, asserting that a write
through `submit()` reaches the store and that an out-of-range size prints the clamped value. One
Playwright spec in the voxel-map suite: open the console, set `brush.size`, and assert the toolbar
reflects it. Run that spec alone, not the suite.

## P7. Pixel-art keybinds

- The `keybind` namespace, one variable per `KeybindingAction`, looping over the actions exported by
  `pixel-draw-renderer`. If the action list is not exported today, export it and document it.
- List parsing: split on commas, trim, and hand the result to `Keybindings.patch()`.
- Persistence of the difference from `DEFAULT_KEYBINDINGS` through `NamespacedStore`, loaded at boot
  into the `keybindings` option, with invalid stored entries dropped and warned about. Parse the
  stored value with zod.
- `/keybind.reset [action]`.

Tests: unit specs with a `MemoryStorageAdapter` covering a write then a simulated reboot, a conflict
producing the `KeybindingConflictError` message as an error entry and leaving storage untouched, a
corrupt stored entry being dropped, and reset of one action and of all. One Playwright spec: rebind
undo from the console, reload, and check the new binding works.

## P8. Documentation and release

- `packages/console/docs/`, flat, written from the consumer's side: registering a namespace,
  commands, variables, the grammar, mounting the element. Link it from the README.
- A changeset for `@jolly-pixel/console`, and one for `pixel-draw-renderer` if P7 exported the action
  list. None for the private editor workspaces.
- Once the docs cover it, delete this file and SPEC.md, or fold what is still true into an ADR
  folder.

## Open points to raise when they come up

1. Whether `KeybindingAction`'s list is already exported from `pixel-draw-renderer` (P7).
2. How the host exposes the instance to editors: a field on the runtime, or on the session. Decide in
   P6 after reading the host's current API shape.
