# EditorSession

`EditorSession` connects an editor to the asset server and follows the
dependency closure of its target. See [editor boot](../concepts/editor-boot.md)
for the lifecycle.

## API

```ts
interface EditorSessionOptions {
  launch: EditorLaunch;
  identity: { title: string; };
  kinds: Iterable<AssetModelKind<unknown>>;
  accepts?: string;
}

interface EditorSessionConnectOptions {
  launch: EditorLaunch;
  identity: PeerIdentity;
  client: EditorSessionClient;
  kinds: Iterable<AssetModelKind<unknown>>;
  accepts?: string;
}

class EditorSession extends Emitter<{
  "dependency-added": (lease: AssetLease<unknown>) => void;
  "dependency-removed": (reference: AssetReferenceData) => void;
}> {
  static open(options: EditorSessionOptions): Promise<EditorSession>;
  static connect(options: EditorSessionConnectOptions): Promise<EditorSession>;

  readonly identity: PeerIdentity;
  readonly catalog: CatalogClient;
  readonly assets: AssetLeases;
  readonly target: AssetRoomLease;

  dependencies(): IterableIterator<AssetLease<unknown>>;
  dependency(assetId: string): AssetLease<unknown> | undefined;
  dispose(): void;
}
```

`open` prompts for the username with `promptPeerIdentity`, stored under
`IDENTITY_STORAGE_KEY`, creates a network client and calls `connect`.
`connect` takes a ready identity and client instead, for tests and custom
transports.

`connect` throws `AssetNotFoundError` for an unknown target and
`AssetKindMismatchError` when `accepts` differs from the target's kind. It
destroys the client on any failure, and disposes the session when a
dependency model rejects its `ready`.

`target` is a room-only lease and its room is not joined. `assets` is the
session's [`AssetLeases`](./AssetLeases.md); panels open their own leases
there. `dispose()` releases every lease, the catalog and the client. A second
call does nothing.
