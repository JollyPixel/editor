# Editor host glossary

This glossary defines the vocabulary for editor launch, mounting, and asset
session ownership in `@jolly-pixel/editor.host`.

## Terms

### Launch

The request to open an editor for one target asset. `EditorLaunch` carries the
target's asset ID.

### Launch source

A reader that supplies a launch from a host message, query string, or injected
page data. Sources are checked in order until one returns a launch.

### Target

The asset opened by the editor. The session holds a room lease for it; the
editor owns its model and synchronization.

### Editor definition

The contract an editor supplies to the host: its accepted asset kind, identity
prompt options, dependency model kinds, and `mount` method.

### Editor context

The launch and connected session passed to the editor's `mount` method.

### Session

The owner of an editor's catalog connection, target room lease, and dependency
leases. It updates dependency leases as the catalog changes and releases its
resources on disposal.

### Asset lease

A consumer's reference to a shared asset room, optionally with a synced model.
Releasing the last lease disposes the model and leaves the room. A room-only
lease exposes the asset record and room without a model.

### Asset model kind

The registration that pairs an asset kind with a factory for its synced model.
The session uses these registrations to lease supported dependencies.

### Synced model

A model bound to an asset room, with a readiness promise and a disposal method.
Leases for the same asset share one synced model.
