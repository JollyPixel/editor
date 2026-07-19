# ConflictResolver

Conflicts are resolved **per pixel**, not per command. A single stroke command can touch thousands of pixels, so [`PixelSyncServer`](./PixelSyncServer.md) splits a command: pixels that lose the race are dropped from the applied/broadcast copy, the rest are applied normally.

Only `"stroke"` goes through a resolver. `"buffer-added"`, `"buffer-removed"`, `"resized"`, `"texture-replaced"`, and `"global-fill"` are always accepted with no per-pixel arbitration.

> [!IMPORTANT]
> `"global-fill"` carries no position list to arbitrate against (see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md)). It's applied by recomputing matching pixels against the server's own authoritative buffer at receive-time, which is self-consistent only because commands are applied in the order the server processes them.

## Types

```ts
interface PixelConflictContext {
  incoming: PixelNetworkCommandHeader;
  /**
   * Header of the last accepted command at the same pixel, if any.
   * `undefined` means no prior command exists at that pixel → always accept.
   */
  existing: PixelNetworkCommandHeader | undefined;
}

/**
 * Determines whether an incoming command should be accepted or rejected
 * given the last known command header at the same pixel.
 *
 * Only the header is tracked (not the full stroke command) since a single
 * stroke can touch thousands of pixels; keeping a full command per pixel
 * would be wasteful.
 */
interface PixelConflictResolver {
  resolve(ctx: PixelConflictContext): "accept" | "reject";
}
```

## `LastWriteWinsResolver`

The default resolver. Higher `timestamp` wins. On a timestamp tie, the lexicographically greater `clientId` wins, giving a deterministic total order without coordination.

```ts
import { LastWriteWinsResolver } from "@jolly-pixel/pixel-draw.renderer";

const server = new PixelSyncServer({
  conflictResolver: new LastWriteWinsResolver() // default, no need to pass explicitly
});
```

## Custom resolver

```ts
import type {
  PixelConflictResolver,
  PixelConflictContext
} from "@jolly-pixel/pixel-draw.renderer";

class FirstWriteWinsResolver implements PixelConflictResolver {
  resolve({ existing }: PixelConflictContext): "accept" | "reject" {
    return existing ? "reject" : "accept";
  }
}

const server = new PixelSyncServer({ conflictResolver: new FirstWriteWinsResolver() });
```
