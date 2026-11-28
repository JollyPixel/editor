# TestStudio

`@jolly-pixel/golem.kit/testing` opens a kind without a server, so an asset package tests its golem code in its own `test/golem/`. Each asset is served by its kind's `AssetKindHandler`, as in the studio.

```ts
import { TestStudio } from "@jolly-pixel/golem.kit/testing";

const studio = new TestStudio({ kinds: GOLEM_KINDS });
const hosted = studio.host("environments/dusk.environment.json", environmentAssetKind());
const environment = await studio.open(hosted.id, "environment");

await environment.change({ fog: { kind: "exp2", density: 0.05 } });
await environment.settled();
hosted.state; // the studio's state of the asset
```

## TestStudio

- `new TestStudio({ kinds, kindPackages? })` opens the contributions in `kinds`. `kindPackages` is what `studio.kindPackages` returns, `[]` by default.
- `host(path, handler)` adds an asset and returns `{ id, state, room }`. Change `state` before `open` to start from a given document.
- `record(record)` adds a catalog entry that nothing serves, for references. `dependencies` is the catalog's `DependencyIndex`.
- `open(assetId, kind)` opens the asset once and waits for `ready`, as `golem.open` does. Assets that a kind opens through `studio.open` come from the same test studio.

## TestRoom

The `room` of a hosted asset. It answers each command the golem sends right away.

- `holdAnswers()` keeps the answers until `answer()`.
- `receive(command)` applies a person's command in the studio. The golem sees it with the answer to its next command, so a test can make that command conflict with it.
- `deny(event, reason)` plays a denial, and `addPeer(peer)` adds a peer whose presence holds a lock.
- Set `right` to `"read"` to play a role that may only read.
- `sent` lists every command sent, and `presence` holds the golem's own presence.
