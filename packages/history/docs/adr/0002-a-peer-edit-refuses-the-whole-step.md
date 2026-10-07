---
status: accepted
---

# A peer edit refuses the whole step

When a peer writes a value a step would write back, the step is refused and undo passes over it,
emitting `skipped`. Nothing of it is undone. `VoxelHistory` used to undo the cells nobody touched
and silently keep the others.

A refusal is visible: `state(scope).refused` lists it, and editors log the skipped step. A partial
undo leaves a state nobody made, and the user cannot tell which part came back.

The same rule covers writes the history never saw. Before replaying, `undo` and `redo` check that
each part's guard still holds its capture, and refuse the step as `changed` otherwise. A voxel layer
moved by this client reports no cell, so a step on the moved cells is refused at undo instead of
writing them at their old world positions.

## Considered Options

- **Skip the changed values, undo the rest** (the former voxel behaviour). Silent, and a stroke half
  undone is still a step the user did not make.
- **Report layer moves as writes.** A local write recaptures the guard, which would make the stale
  step undoable again, at the wrong positions.

## Consequences

- An undo can do nothing but skip, and say why.
- A document's guard only needs to cover what its undo writes; anything else that changes those
  values is caught at undo.
