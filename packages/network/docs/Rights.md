# Rights

Role-based access control for rooms. Off by default — a `Server` built without a `rights` option lets every client do everything.

## Configuring

One table covers every room registered on the server. The vite plugin takes the same shape.

```ts
const server = new Server({
  rights: {
    viewer: {
      "voxel.renderer.$join": "write",
      "voxel.renderer.$presence": "write",
      "voxel.renderer.voxel-set": "read",
      "voxel.renderer.*": "void"
    },
    editor: {
      "voxel.renderer.$join": "write"
    }
  }
});
```

## Roles

A role is a plain string. The keys of the table are the server's role vocabulary, and [authentication](./Authentication.md) decides which one a connection gets. Clients cannot name their own role.

`defaultRole` picks the role for connections nothing elevates, and must be one of the table's keys:

```ts
new Server({
  rights: { viewer: { ... }, editor: { ... } },
  defaultRole: "viewer"
});
```

Omit both `rights` and `defaultRole` and an implicit `"default"` role applies, with `"write"` everywhere.

## Keys

Keys are `${extension.name}.${event}`.

- `extension.name` is the extension's *type*, not a room `id` — one rule covers every room backed by the same extension class.
- `event` is a domain event name, or one of the reserved `$join` / `$presence` / `$message` / `$snapshot`.
- `*` matches anything, including `.`; every other character is literal.
- First matching pattern wins, in declaration order — put exceptions before catch-alls.

Domain event names come from the extension's [message protocols](./Extension.md#message-protocols): each schema variant names one event, and `protocolEvents(protocol)` lists them. An event name that appears in no variant can never match a message, so a rule mentioning it is dead.

`$message` is not a rights key. It is the `event` field on the `"error"` envelope a client gets back when its payload fails the room's inbound schema.

`$snapshot` is the event `serverMessageProtocol()` gives a `{ type: "snapshot" }` broadcast, so a snapshot can be filtered separately from the commands that follow it.

## Rights

| Right | Send | Receive |
|---|---|---|
| `"write"` | yes | yes |
| `"read"` | no | yes |
| `"void"` | no | no |

`"void"` is real fan-out filtering: the payload never reaches that client, whether it came from `broadcast()` or `sendTo()`. For `$join`, `"read"` behaves like `"void"` — admission is binary.

Unmatched keys resolve in two different ways, because they mean different things:

| Case | Right |
|---|---|
| No table at all | `"write"` — RBAC is opt-in |
| A role absent from a configured table | `"void"` — the table is an allowlist |
| A listed role, no pattern matching the key | `"write"` — put exceptions before catch-alls |

A role the table never mentions is a mismatch between authentication and rights, so it is denied rather than waved through. Within a role the host wrote, an unmatched key still falls open; close it with a `*` catch-all.

## Ungated extensions

An extension whose `protocols.inbound` is `null` accepts any payload without parsing it, so the server cannot name the event a rule would match. Registering one on a server that has a rights table throws `UngatedExtensionError`. Give the extension an inbound protocol, or `NO_MESSAGE_PROTOCOLS` if it carries no domain messages.

## Denials

A rejected join, presence update or send never reaches the extension. The offending client — and only that client — receives a `"denied"` event naming the event (`"$join"`, `"$presence"`, or the domain event) and a reason.

## Reading rights on the client

A joining client is told its own resolved rights, so UI can adapt before it is denied anything:

```ts
room.on("sync", () => {
  if (room.access === "read") {
    disableEditing();
  }
  paintTool.enabled = room.can("voxel-set") === "write";
});
```

`room.rights` maps `$presence` plus every inbound and outbound event of the room's extension to a right. `can(event)` looks one up, returning `"void"` for an event the map does not mention. `access` summarises: `"write"` when anything is writable, else `"read"` when anything is receivable, else `"void"` — good enough to decide whether to show an editing surface, never enough for per-tool decisions.

`$join` is absent from the map: a role denied `$join` is not in the room to receive it.

The map is a UI affordance. The server still gates every write, and `"denied"` remains the authority.
