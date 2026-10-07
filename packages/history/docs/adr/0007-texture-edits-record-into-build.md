---
status: accepted
---

# voxel-model texture edits record into the build scope

voxel-model's texture canvas records into the `build` scope of the model's history. Painting a
texture and shaping the model are one task in the build tab, so one undo stack walks back through
both in order. The canvas waits for the workspace before it records.

## Considered Options

- **The active tab's scope.** The same canvas would record into different stacks depending on the
  tab, and a stroke could be undone from a tab that does not show it.
- **A `paint` scope.** A third stack for the same tab, and the order between texture and model edits
  is lost.
