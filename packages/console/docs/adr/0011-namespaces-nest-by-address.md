---
status: accepted
---

# Namespaces nest by dotted address, and parents are implicit

A namespace address may hold dots: `pixelart.keybinds` nests under `pixelart`. The registry stays a
flat map keyed by address, and an address splits at its last dot. A parent that nobody registered
exists, empty and without a description, while one of its nested namespaces is registered.

Packages embedded in several editors need a prefix of their own. The pixel-art panel lives in its
own editor, in voxel-map and in voxel-model, and a flat `keybind` namespace would collide with the
host's shortcuts. Implicit parents let separate features share `pixelart` (the library registers
`pixelart.keybinds`, the pixel-art page `pixelart.preview`) without agreeing on who owns it.

## Considered Options

- **Child namespaces registered through the parent handle.** The parent owns its children and
  removes them with it, but two features sharing a parent would replace each other
  ([ADR-0003](./0003-last-registration-wins.md)).
- **Prefixed member names** (`pixelart.keybind-undo`). No console change, but long names and one
  section for every pixel-art setting.

## Consequences

- `RegisteredNamespace.name` is the last part of the address; code that needs the full path reads
  `address`.
- Implicit parents are rebuilt on every namespace change, so their identity is not stable.
- The mirror protocol carries full addresses, so a nested namespace mirrors without change.
  `ConsoleServer` leaves implicit parents out of its snapshot, and `ConsoleMirror` does not count
  an implicit parent of the shell as a namespace the shell owns.
