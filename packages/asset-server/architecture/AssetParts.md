# Asset parts

Status: in progress for terrain milestone M2. The kind contract, writes,
generations, replay and compaction are implemented. Part files, the
subscription and the filtered broadcast are not yet.

An asset is one file, its live state is held whole by the room, sent whole on
join, and every `asset.updated` checkpoint carries the whole content. A large
terrain does not fit that model. Asset parts let a kind split its content
into a manifest and many parts that are stored, loaded and sent one by one.

A kind without parts keeps today's behavior. Nothing below applies to it.

## Vocabulary

- **Manifest:** the content every member of the room needs. It is the
  asset's main file and the room's join snapshot.
- **Part:** a binary piece of the content, named by a part ID the kind
  chooses, such as `12_-3` for a terrain chunk. A part ID matches
  `[A-Za-z0-9_-]+`.
- **Generation:** one checkpoint of a parted asset: the manifest, the bytes of
  the parts it changed and the version that holds each other part.

## Storage layout

The asset file holds the manifest. Parts live in a sibling folder named after
the asset file with `.parts` appended:

```
world.terrain
world.terrain.parts/
  0_0.bin
  0_1.bin
```

The part file extension comes from the kind. The catalog keeps one path per
asset: the manifest's. Rename, move and delete carry the sibling folder with
the asset file. The reconciler and `CatalogFolders` never treat a `.parts`
folder or its files as assets or folders of their own. An external edit to a
part file is an update of its asset. Archives and tags hold the parts with
the manifest.

## Kind contract

A kind declares parts with an optional `parts` field on its handler:

| Member | Role |
|---|---|
| `extension` | Part file extension, mapped to its media type. |
| `touched(command)` | Part IDs a command writes. |
| `list(state)` | Part IDs the manifest names. |
| `load(state, partId, content)` | Loads one part into the state. |
| `serialize(state, partId)` | Bytes of one part. |

The subscription adds the wire form of one part and `outside(command)`, the
form of a command sent to members not subscribed to its parts.

For a parted kind, the handler's `serialize` and `load` handle the manifest
only, and `live().snapshot()` is the manifest's wire form. A client applies
commands to the parts it has loaded and skips the others.

## Checkpoints

A generation is one `asset.updated` event, so it is appended whole or not at
all. Its `content` is the manifest, and its `parts` map names every part the
manifest lists:

```json
{
  "parts": {
    "0_0": { "hash": "…", "size": 16384, "at": 12 },
    "0_1": { "hash": "…", "size": 16384, "content": { "type": "inline", "encoding": "base64", "data": "…" } }
  }
}
```

A part touched by a command since the last generation is serialized again and
written inline when its hash changed. Any other part keeps `at`, the version
of the checkpoint that holds its bytes. A part the manifest no longer lists
leaves the map. The scheduler skips the generation when neither the manifest
nor a part changed. `asset.created` takes the same `parts` map, every part
inline.

Replay starts from the newest checkpoint, as for other kinds, so no command is
folded twice. It loads the manifest, then each part from the checkpoint its
`at` names.

Compaction removes events below each asset's head checkpoint. It keeps the
checkpoints that the head and every tagged event name in `at`, through the
`keep` option of the event store's `compact`.

The catalog revision of a parted asset is the manifest hash and the
generation's version, `<hash>@<version>`, since an edit can change parts
without changing the manifest.

The projector writes the manifest file and each part file whose hash changed,
and deletes the files of parts that left the map.

## Server state

The room's live state holds the manifest and every part, loaded by replay as
described above. Arbitration stays synchronous. Streaming applies to
the wire and to storage, not to server memory: a 10 km² terrain at ×1 holds
about 40 MB per open asset.

Loading parts on demand on the server, and unloading those no member
subscribes to, is later work.

## Subscription

A client sends `subscribeParts` with part IDs, and `unsubscribeParts` when it
no longer needs them. Both are room messages handled by the asset room, not
by the kind's relay.

The room answers `subscribeParts` with a `parts` message: the wire form of
each part at the room's current version. A subscription and its content are
taken at the same version, so no command falls between them. A part the
manifest does not name is answered with `null`.

## Broadcast

The room sends an accepted command to the members subscribed to at least one
of its touched parts, and always to its author, so the pending ledger
receives its echo. The other members receive `outside(command)` when the kind
defines it, and nothing otherwise. A client tracks the highest version it has
seen and does not check for gaps, so a filtered stream does not break
`CommandSync`.

A resume catch-up still sends every command since the client's version. A
client ignores the parts it has not loaded.

## Join

The join snapshot is the manifest. A resync sends the manifest and the parts
the client subscribes to.
