# ConflictResolver

Conflicts are resolved **per pixel** for strokes, not per command. A single stroke command can touch thousands of pixels, so [`PixelSyncServer`](./PixelSyncServer.md) splits a command: pixels that lose the race are dropped from the applied/broadcast copy, the rest are applied normally.

`"stroke"` and `"select-edit"` share the same per-pixel history — they compete for the same pixels the way two strokes would. `"uv-region-moved"`/`"uv-region-deleted"` go through the same resolver — keyed **per region id** instead of per pixel, and rejected/accepted as one atomic unit (no partial application, since a region isn't a list of independently-owned cells). `"resized"`, `"texture-replaced"`, `"global-fill"`, and `"uv-region-created"` are always accepted with no arbitration.

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

The default resolver. A command from the **same client** as the pixel's last accepted command always wins, regardless of timestamp — see below. Otherwise, higher `timestamp` wins; on a timestamp tie, the lexicographically greater `clientId` wins, giving a deterministic total order without coordination.

> [!IMPORTANT]
> The same-client short-circuit exists for undo/redo replay. A replayed edit is stamped with its *original* commit's timestamp (`originTimestamp`, see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md)) instead of "now", so it fairly re-races against another client's edit at that pixel. But `undo()` unwinds history newest-entry-first: two overlapping edits from the *same* client replay with a newer timestamp first, then an older one — and a plain timestamp comparison would reject that second, older-timestamped replay as stale, even though it's the same client legitimately continuing to unwind its own history. Since one client's commands always arrive in the order it sent them (single WebSocket connection, TCP-ordered), trusting the latest one it sends is always safe — the timestamp comparison only needs to arbitrate between genuinely different clients.

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
