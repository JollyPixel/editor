# Architecture

The `SceneDocument` of the target lease is the only state that is saved. Everything else in this editor follows it.

## Viewport

- `SceneEditorScene` assembles the editor when the runtime wakes it, and resolves `SceneEditing`, the object every pane attaches to.
- `SceneBinding` builds the document's actors with the engine's `SceneBuilder` in edit mode and keeps them current per command. A component data change goes through the definition's `apply` when it has one, otherwise the component is rebuilt. A document reset rebuilds everything.
- `EditAssets` is the edit-mode `ComponentAssetResolver`. It answers the `VoxelMap` component's `map` slot with one `VoxelMapViewer` per map, shared by every component that shows it, and releases the viewer a microtask after its last view detaches, so a component rebuild keeps the lease.
- `SceneBinding` reports each component it builds or drops. `SceneHelpers` follows those events to draw a frustum for each camera and a marker for each light, synced every frame, and registers each helper as a pick target of its actor in the binding, so `ActorPicker` asks only the binding.
- `SceneGizmo` drives `TransformControls` from `@jolly-pixel/three` on the primary selection and commits one `actor-transformed` command when a drag ends.

## Editing

- `SceneActions` holds the edits that span several commands (duplicate, delete, reparent) and records each as one history step.
- Adding a preset actor or a component asks for an asset for every slot its definition declares, so a `VoxelMap` needs no code of its own. A cancelled pick adds nothing, and a new actor takes the name of the first asset picked.
- `components/sceneComponents.ts` lists each component type with its label, icon and inspector form. The hierarchy icons, the add menus and the inspector all read it.
- Reparenting rewrites the moved actor's transform from the file data, so it keeps its world pose whatever the binding has drawn.
- The inspector forms are row descriptors in `components/componentForms.ts`, `Script` included. A row edit becomes a `component-changed` patch of one top-level field; a nested field rewrites its whole object, as the room requires.

## Collaboration

`SceneCollaboration` publishes the primary selection under the `actor` presence key, shown as badges in the hierarchy, and draws peer frustums.
