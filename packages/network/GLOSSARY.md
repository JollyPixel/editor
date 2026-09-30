# Network glossary

This glossary defines the vocabulary for authenticated connections, room
membership, message routing, authorization, and shared synchronization
helpers. The network bounded context carries feature messages. Extensions and
consuming workspaces own their domain meaning and persistence.

## Connection and rooms

### Connection

One authenticated transport link between a client and the server. A
connection owns one client ID and can join several rooms through the same
WebSocket.

### Client ID

The server-assigned identity of one connection. It is fixed for the connection
lifetime, scopes dispatch ordering and room membership, and is visible to room
peers.

### Room

A named collaboration boundary for one feature instance. A room owns its
membership, peer presence, resolved rights, and feature-message flow while
sharing a connection with other rooms.

### Membership

The admitted relationship between one connection and one room. Membership
starts when a join passes the room's rights check and ends on leave or socket
disconnect. It carries the peer's profile and room-scoped presence.

### Peer

A room member as exposed to other members. A peer has a client ID, role,
profile, and presence. On the browser, `Room.peers` contains remote peers and
excludes the local member.

### Extension

The server-side feature behavior attached to a room. An extension declares its
message protocols and handles accepted joins, messages, and departures. The
network layer retains ownership of routing, validation, membership, and rights
checks.

### Room Resolution

The creation of a dynamic room when its name is first joined. A room resolver
supplies the extension and may supply an eviction hook or a room-specific grace
period. Messages to an unknown room do not trigger resolution.

### Room Eviction

The teardown of an empty dynamic room after its grace period. Eviction calls
the resolution's `onEvict` hook before disposing the extension. Static rooms
remain registered until the server closes.

## Trust and authorization

### Peer Identity

The trusted `{ subject, role }` assigned by an authentication provider. The
identity is fixed for the connection lifetime. Extensions receive both fields;
room peers receive the role only.

### Subject

The server-side identifier for the authenticated principal. A host that
persists events can use the subject as the event's
[actor](../event-store/GLOSSARY.md#actor).

### Role

The name used to select one entry in the server's rights table. Authentication
assigns the role, and room members can see it. Client profile data cannot
change it.

### Profile

Untrusted metadata configured by the client and attached to every room join,
such as a display name. A profile is reused across rooms and remains unchanged
by presence updates.

### Presence

Untrusted, mutable metadata scoped to one room membership, such as a cursor
position. Presence patches are shallow-merged and shared only with members
allowed to read the reserved `$presence` event.

### Right

The access level resolved for a role and event. `write` permits sending and
receiving, `read` permits receiving, and `void` permits neither. Admission to a
room requires `write` on `$join`.

### Rights Key

The `${extension.name}.${event}` name matched by a rights rule. The extension
name identifies the feature type across room instances. The event identifies a
protocol variant or a reserved room operation.

## Wire and message protocols

### Envelope

The JSON wire unit routed by the network layer. Every envelope names a room,
has an envelope kind, and may carry membership data or a feature message.

### Envelope Kind

The transport operation selected by an envelope's `kind` field. Kinds include
`join`, `leave`, `message`, `presence`, `sync`, and peer lifecycle
notifications.

### Message

A feature-owned payload carried inside a `message` envelope. The room's
extension interprets inbound messages and produces outbound messages.

### Message Protocol

The JSON Schema contract for one direction of a room's feature messages. The
inbound protocol validates client messages before the extension receives them.
The outbound protocol validates extension output and selects which members may
receive it.

### Protocol Event

The event name derived from a matched message-schema variant. A variant names
its event through its `title` or discriminator value. Rights checks use this
name within the extension namespace.

### Reserved Event

A network-owned event whose name starts with `$`. `$join` gates room
admission, `$presence` gates presence updates, and `$snapshot` identifies a
feature snapshot in a server message protocol. `$message` labels an inbound
payload rejected by schema validation; it is not a rights key.

## Synchronization

### Room Sync

The `sync` envelope sent after a join is admitted. It establishes the local
client ID and role, resolved room rights, and the current membership snapshot.
The browser uses it to seed its remote-peer mirror.

### Network Command

A feature command carrying `clientId`, `seq`, and `timestamp` alongside its
domain fields. `CommandSync` stamps outgoing commands and treats the local
client's echoed commands as acknowledgements. Extensions remain responsible
for accepting, applying, and persisting them.

### Pending Command

A local command `CommandSync` sent and the server has not acknowledged yet.
It stays in the pending ledger with the inverse its reconciler captured, and
is replayed on top of every server change until it is acknowledged.

### Ack

The server's statement that it processed a client's commands up to a `seq`,
whether it admitted, narrowed or rejected them. An own echo acknowledges its
`seq`; snapshots and corrections carry an `acks` map. Acks are cumulative.

### Rebase

Rebuilding the local state after a server change: revert the pending
commands, apply the change, replay the pending commands. It never rewrites
anything on the server. Absolute register writes skip the revert and drop
the incoming entries a pending write outlives.

### Resync

A client's request for a fresh snapshot, sent as the `resync` envelope when
a pending command cannot be reverted.

### Room Version

The event-store `eventVersion` of the last event folded into a room's
state. Asset rooms send it on every command broadcast and snapshot;
`CommandSync` keeps the highest one it applied.

### Resume

Rejoining a room after a reconnect with the previous client ID and the last
room version seen, so the extension can send a catch-up of the missed
commands instead of a snapshot, and acknowledge the previous connection's
commands.

### Snapshot

A complete representation of feature state sent as an outbound room message.
`CommandSync` emits the snapshot and becomes ready when it receives the first
one. Snapshot contents belong to the feature using the room.

### Server Notice

A feature-defined outbound synchronization message whose `type` is none of
`snapshot`, `command` and `correction`. `CommandSync` exposes notices separately so a feature
can report outcomes such as `rejected` or `deleted`.

### Conflict Key

A feature-defined string naming one unit of competing state. `ConflictTracker`
keeps the last committed command header for each key and asks its resolver to
compare that header with an incoming command.

### Admission

A provisional conflict-resolution result. An admission exposes the accepted
command or accepted indices together with `commit()`. The caller commits only
after the accepted change has been applied or persisted.

### Last Write Wins

The default conflict rule for commands from different clients. The command the
server processes last wins, unless its `basis` says it replays a command older
than the one it would overwrite. Commands recorded without a room version fall
back to the newer timestamp, with client ID as the tie-breaker. Commands from
the same client always win.

### Basis

The room version of the command an undo or a redo replays, sent in the
command header. The client learns it from the echo of the original command.

## Naming boundaries

- Use **client ID** for a connection, **subject** for the authenticated
  principal, and [**actor**](../event-store/GLOSSARY.md#actor) for the origin
  recorded on a persisted event.
- Use **peer identity** for trusted server-assigned data, **profile** for
  client-supplied connection metadata, and **presence** for mutable room data.
- Use **room ID** or **room name** for one room instance and **extension name**
  for the feature namespace used by rights keys.
- Use **envelope kind** for a transport operation and **protocol event** for a
  schema-selected rights event. A persisted occurrence is a
  [**domain event**](../asset-server/GLOSSARY.md#domain-event).
- Use **message** for a feature payload and **network command** for a stamped
  request to change feature state. Acceptance may produce a domain event in a
  consuming bounded context.
- Use **room sync** for the membership and rights state sent after joining,
  **snapshot** for complete feature state, and
  [**checkpoint**](../event-store/GLOSSARY.md#checkpoint) for an event that
  lets replay skip earlier history.
- Use **authentication** for assigning a peer identity and **authorization**
  or **rights** for deciding which room operations and protocol events it may
  perform or receive.
- Use **denied** for a rights rejection, **error** for rejected input or a
  failed extension flow, and **malformed** for a server message rejected by a
  browser-side room parser.
- Use **registration** for adding a static room, **resolution** for creating a
  dynamic room on first join, and **eviction** for tearing down an empty
  dynamic room.
