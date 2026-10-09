# Network glossary

People collaborating on an asset need to see who else is there, what they are
doing, and how their edits affect the shared result. Rooms bring participants
together. Presence describes their activity, permissions govern their access,
and synchronization keeps their views of the edited state in agreement.

## Collaboration

### Room

A place for collaboration on one feature instance, such as an open asset.
Participants in the same room can see each other and exchange activity under
that room's permissions. Activity in one room stays separate from other rooms.

### Extension

The feature behavior attached to a room. It decides what participants' activity
means and how it affects shared state. Several rooms can use the same kind of
extension, such as separate assets using the same editing feature. The network
layer handles participation and permissions around that behavior.

### Envelope

The wrapper used to carry activity to or from a room. It identifies the room
and the kind of activity, such as joining, updating presence, or sharing a
feature message. The feature owns the meaning of the message inside it.

### Peer

Another participant in the room. A peer represents one active participation,
so a person editing from two tabs can appear as two peers.

### Profile

Information describing a participant, such as a display name or avatar. It
helps others recognize them and is reused across rooms.

### Presence

Information describing what a participant is doing in a particular room, such
as their cursor position or selection. It changes as they work and disappears
when they leave. A participant can have different presence in different rooms.

### Role

A named category of access, such as viewer or editor. It determines which
rights a participant has for the feature they are using.

### Right

Permission to perform or observe an activity. A participant may be able to
make and receive edits, receive them without editing, or have no access to
that activity. Rights can differ between activities in the same room.

## Shared editing

### Shared state

The feature state participants are collaborating on, such as an image's pixels.
Each participant works with a local view. The feature on the server decides
which edits become part of the authoritative state.

### Command

A request to change shared state, such as painting pixels or changing an
attribute. The feature decides whether to accept the request and how it changes
the state. A command can be accepted in full, accepted in part, or refused.

### Pending command

A local edit whose server outcome is not yet known. It can already be visible
locally so editing remains responsive. Incoming server changes must be
reconciled with that pending work; a refused edit may need to be undone.

### Snapshot

A complete representation of shared state at a point in time. It gives a
participant a starting view or replaces a view that needs to be restored.
The feature decides what the snapshot contains.

### Conflict

Competing edits to the same part of shared state, such as two participants
painting the same pixel. The feature's conflict rule decides which changes
are accepted.

### Last write wins

A conflict rule that gives precedence to the latest competing write. The
feature defines which write counts as latest. Undoing or redoing an older edit
can be refused when it would overwrite another participant's newer work.

The [architecture](./ARCHITECTURE.md) explains connections and room lifecycles.
[Rights](./docs/server/Access.md#rights) covers permission rules;
[CommandSync](./docs/client/CommandSync.md) covers synchronization mechanics;
[Conflicts](./docs/client/CommandSync.md#conflict-resolution) covers conflict policies.
