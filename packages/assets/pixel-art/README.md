# @jolly-pixel/asset.pixel-art

Persistence and real-time collaboration for pixel-art documents rendered by
`@jolly-pixel/pixel-draw.renderer`.

Browser clients import synchronization and presence APIs from
`@jolly-pixel/asset.pixel-art/network/client.ts`. Server hosts import the
authoritative extension and validation APIs from
`@jolly-pixel/asset.pixel-art/network/server.ts`.

## Browser client

```ts
import { Client } from "@jolly-pixel/network/client";
import {
  PixelSyncClient,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/network/client.ts";

const networkClient = new Client();
const room = networkClient.room<
  PixelNetworkCommand,
  PixelServerMessage
>("pixel-draw:main");
const sync = new PixelSyncClient({ room });

sync.attach(canvas);
room.join();
```

## Server

Use `PixelSyncServer` for an in-memory collaborative buffer:

```ts
import {
  PixelSyncServer
} from "@jolly-pixel/asset.pixel-art/network/server.ts";
import { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";

const extension = new PixelSyncServer({
  id: "pixel-draw:main",
  buffer: new PixelBuffer({ size: { x: 80, y: 80 } })
});
```

For persisted `.pixelart` files, register `pixelArtAssetHandler()` from the
package root with `@jolly-pixel/asset-server`.

The [network guide](./docs/network/guides/setup.md) covers startup order,
snapshots, rights, and teardown. The [asset kind guide](./docs/asset/index.md)
documents event replay and persistence.
