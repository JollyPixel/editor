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

A role is a plain string read from `identity.role` when the client joins, falling back to `"default"`.

> [!WARNING]
> The role is supplied by the client and never verified. This is not authentication. Resolve the real identity yourself (session, JWT, ...) before building the `identity` you pass to `room.join()`.

## Keys

Keys are `${extension.name}.${event}`.

- `extension.name` is the extension's *type*, not a room `id` — one rule covers every room backed by the same extension class.
- `event` is a domain event name, or one of the reserved `$join` / `$presence`.
- `*` matches anything, including `.`; every other character is literal.
- First matching pattern wins, in declaration order — put exceptions before catch-alls.

## Rights

| Right | Send | Receive |
|---|---|---|
| `"write"` | yes | yes |
| `"read"` | no | yes |
| `"void"` | no | no |

`"void"` is real fan-out filtering: the payload never reaches that client. For `$join`, `"read"` behaves like `"void"` — admission is binary.

Anything unmatched fails open to `"write"`: no table, an unknown role, or a key no pattern matches. A typo grants access rather than revoking it.

## Denials

A rejected join, presence update or send never reaches the extension. The offending client — and only that client — receives a `"denied"` event naming the event (`"$join"`, `"$presence"`, or the domain event) and a reason.
