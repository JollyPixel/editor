# Architecture

The `SceneDocument` of the target lease is the only state that is saved. Everything else in this editor follows it.

## Viewport

- `SceneEditorScene` assembles the editor when the runtime wakes it, and resolves `SceneEditing`, the object every pane attaches to.
- `SceneBinding` builds the document's actors with the engine's `SceneBuilder` in edit mode and keeps them current per command. A component data change goes through the definition's `apply` when it has one, otherwise the component is rebuilt. A document reset rebuilds everything.
- `EditAssets` is the edit-mode `ComponentAssetResolver`. It routes each asset slot to the `SceneAssetSource` of its kind, opens that source's resolver the first time a component needs it, and disposes every opened resolver with the scene.
- `SceneBinding` reports each component it builds or drops. `SceneHelpers` follows those events to draw a frustum for each camera and a marker for each light, synced every frame, and registers each helper as a pick target of its actor in the binding, so `ActorPicker` asks only the binding.
- `SceneGizmo` drives `TransformControls` from `@jolly-pixel/three` on the primary selection and commits one `actor-transformed` command when a drag ends.

## Editing

- `SceneActions` holds the edits that span several commands (duplicate, delete, reparent) and records each as one history step.
- Adding a preset actor or a component asks for an asset for every slot its definition declares, so a `VoxelMap` needs no code of its own. A cancelled pick adds nothing, and a new actor takes the name of the first asset picked.
- `SceneComponents` holds every component type with its engine definition, label, icon and inspector form, each package's presets and the asset sources. The hierarchy icons, the add menus, the asset picks, the inspector and the binding's `ComponentDefinitions` all read it from `SceneEditing.components`. `ActorPresetMenu` turns the presets into the hierarchy's Add menu, once per scene, as `SceneEditing.presets`.
- A component whose type no package provides keeps its data. The binding builds nothing for it, and the inspector shows its raw data.
- `SelectionStore` follows the document: an actor that a command or a reset removes leaves the selection.
- `SceneDraft` holds the values a field shows while it is scrubbed (environment, transform, component data) and previews them through `SceneBinding`. The draft of a target ends when it is committed, when a command changes that same target, or on a reset. A commit the document refuses redraws the stored value.
- Reparenting rewrites the moved actor's transform from the file data, so it keeps its world pose whatever the binding has drawn.
- The built-in inspector forms are row descriptors in `components/componentForms.ts`, `Script` included. A row edit becomes a `component-changed` patch of one top-level field, unset when set back to its default. A nested field rewrites its whole object, as the room requires.
- Dragging a component folder by its grip, or moving it with the keyboard, commits one `component-moved` command on drop. The order lives in the document, never in pane storage. A gesture is cancelled when the component list changes under it.

## Collaboration

`SceneCollaboration` publishes the primary selection under the `actor` presence key, shown as badges in the hierarchy, and draws peer frustums.

## Component packages

`boot/projectComponents.ts` builds the editor's `SceneComponents` from two sources: the built-in package (`Camera`, `Light`, `Mesh`, `Script`) in `components/builtInComponents.ts`, then the `SCENE_COMPONENTS` export of every project package whose manifest names a `jollypixel.scene` subpath. The contract lives in `@jolly-pixel/editor.host/scene`.

The packages come from `virtual:jolly-pixel/contributions/scene`, which asset-server's `createProjectContributionsPlugin` generates at build time. In the studio the plugin reads the project file's `editors` and `kinds`. The standalone dev server reads the kinds of its own project file plus `@jolly-pixel/editor.voxel-map`, which provides `VoxelMap`. Adding a package therefore needs a rebuild of this page.

`SceneEditor.kinds` and the asset picker's descriptors are read from the same registry, so a package's lease kinds are known before the session opens.
