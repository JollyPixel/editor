# Network Sync Layer

The network sync layer adds **transport-agnostic, server-authoritative multiplayer** on top of the existing voxel renderer. It lets multiple clients share the same voxel world in real time without coupling the renderer to any specific transport technology.

## Architecture overview

```
┌─────────────┐   local mutation   ┌──────────────────┐   sendCommand   ┌─────────────┐
│VoxelRenderer│──────────────────▶│ VoxelSyncClient  │────────────────▶│  Transport  │
│  (Three.js) │                   │                  │◀────────────────│ (WebSocket, │
│             │◀──applyRemote──── │                  │   onCommand     │  WebRTC, …) │
└─────────────┘                   └──────────────────┘                 └──────┬──────┘
                                                                              │  wire
                                                                              ▼
                                                                   ┌─────────────────┐
                                                                   │ VoxelSyncServer │
                                                                   │  (headless)     │
                                                                   │  VoxelWorld     │
                                                                   └─────────────────┘
```

**Flow:**
1. A local mutation (e.g. `setVoxel`) fires the `onLayerUpdated` hook.
2. `VoxelSyncClient` intercepts the hook, stamps the command with `clientId / seq / timestamp`, and calls `transport.sendCommand(cmd)`.
3. The transport sends the command over the wire to `VoxelSyncServer.receive()`.
4. The server validates the command (LWW conflict resolution), applies it to its authoritative `VoxelWorld`, and broadcasts it to all connected clients.
5. Each client's transport calls `onCommand(cmd)`, which `VoxelSyncClient` routes to `renderer.applyRemoteCommand(cmd)`.
6. `applyRemoteCommand` sets an internal flag so that the resulting hook event is **not** re-emitted — preventing infinite echo loops.

## VoxelTransport interface

You must supply a concrete transport implementation. The interface is minimal:

```ts
interface VoxelTransport {
  readonly localClientId: string;
  sendCommand(cmd: VoxelNetworkCommand): void;
  requestSnapshot(): void;
  onCommand: ((cmd: VoxelNetworkCommand) => void) | null;
  onSnapshot: ((snapshot: VoxelWorldJSON) => void) | null;
  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
```

### WebSocket example stub

```ts
import type { VoxelTransport, VoxelNetworkCommand } from "@jolly-pixel/voxel.renderer";
import type { VoxelWorldJSON } from "@jolly-pixel/voxel.renderer";

class WebSocketTransport implements VoxelTransport {
  readonly localClientId = crypto.randomUUID();
  onCommand: ((cmd: VoxelNetworkCommand) => void) | null = null;
  onSnapshot: ((snapshot: VoxelWorldJSON) => void) | null = null;
  onPeerJoined: ((peerId: string) => void) | null = null;
  onPeerLeft: ((peerId: string) => void) | null = null;

  constructor(private ws: WebSocket) {
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data as string);
      switch (msg.type) {
        case "snapshot": this.onSnapshot?.(msg.data); break;
        case "command":  this.onCommand?.(msg.data);  break;
        case "peer-joined": this.onPeerJoined?.(msg.peerId); break;
        case "peer-left":   this.onPeerLeft?.(msg.peerId);   break;
      }
    });
  }

  sendCommand(cmd: VoxelNetworkCommand): void {
    this.ws.send(JSON.stringify({ type: "command", data: cmd }));
  }

  requestSnapshot(): void {
    this.ws.send(JSON.stringify({ type: "snapshot-request" }));
  }
}
```

## VoxelSyncClient

### Setup

```ts
import {
  VoxelSyncClient,
  type VoxelSyncClientOptions
} from "@jolly-pixel/voxel.renderer";

const client = new VoxelSyncClient({
  renderer: vr,         // pre-constructed VoxelRenderer
  transport: myTransport
});
```

The client:
- Replaces `renderer.onLayerUpdated` with its own interceptor.
- Wires `transport.onCommand` and `transport.onSnapshot`.

### Lifecycle

```ts
// When the session ends:
client.destroy();
```

`destroy()` clears `renderer.onLayerUpdated` and the transport callbacks so the renderer
reverts to standalone mode.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `renderer` | `VoxelRenderer` | The local renderer to synchronize. |
| `transport` | `VoxelTransport` | Your transport implementation. |

## VoxelSyncServer

The server runs **headlessly** (no Three.js dependency) and can be used in Node.js, Deno, or Bun.

### Setup

```ts
import { VoxelSyncServer, type ClientHandle } from "@jolly-pixel/voxel.renderer";

const server = new VoxelSyncServer();
// Optionally pass an existing world:
// const server = new VoxelSyncServer({ world: existingVoxelWorld });
```

### WebSocket server example

```ts
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3000 });

wss.on("connection", (ws) => {
  const client: ClientHandle = {
    id: crypto.randomUUID(),
    send: (data) => ws.send(JSON.stringify(data))
  };

  server.connect(client);     // sends snapshot to new client

  ws.on("message", (raw) => {
    const cmd = JSON.parse(raw.toString());
    server.receive(cmd);      // validate → apply → broadcast
  });

  ws.on("close", () => server.disconnect(client.id));
});
```

### API

| Method | Description |
|--------|-------------|
| `connect(client)` | Registers client; sends current snapshot; notifies peers. |
| `disconnect(clientId)` | Removes client; notifies remaining peers. |
| `receive(cmd)` | Validates, applies, and broadcasts a command. |
| `snapshot()` | Returns the current world as `VoxelWorldJSON`. |
| `world` | The authoritative `VoxelWorld` instance. |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `world` | `VoxelWorld` | new world | Existing world to use as authoritative state. |
| `chunkSize` | `number` | `16` | Chunk size when creating a new world. |
| `conflictResolver` | `ConflictResolver` | `LastWriteWinsResolver` | Custom conflict strategy. |

## VoxelNetworkCommand — wire format

A `VoxelNetworkCommand` is a `VoxelLayerHookEvent` extended with routing metadata:

```ts
type VoxelNetworkCommand = VoxelLayerHookEvent & {
  clientId: string;   // originating client ID
  seq: number;        // monotonically increasing per client
  timestamp: number;  // Unix ms (Date.now()) at time of mutation
};
```

Commands are plain JSON-serializable objects — no special framing required.

## ConflictResolver

### Default: LastWriteWinsResolver

The default resolver uses **timestamp** to determine which command wins at a given voxel
position. On a tie, the lexicographically greater `clientId` wins (deterministic without
coordination).

```ts
import { LastWriteWinsResolver } from "@jolly-pixel/voxel.renderer";

const server = new VoxelSyncServer({
  conflictResolver: new LastWriteWinsResolver() // default, no need to pass explicitly
});
```

### Custom resolver

Implement `ConflictResolver` for custom strategies (e.g. first-write-wins, priority by
role, etc.):

```ts
import type { ConflictResolver, ConflictContext } from "@jolly-pixel/voxel.renderer";

class FirstWriteWinsResolver implements ConflictResolver {
  resolve({ existing }: ConflictContext): "accept" | "reject" {
    // Accept only if no prior command exists at this position
    return existing ? "reject" : "accept";
  }
}

const server = new VoxelSyncServer({ conflictResolver: new FirstWriteWinsResolver() });
```

> **Note:** Conflict resolution only applies to per-position voxel operations (`"voxel-set"`,
> `"voxel-removed"`). Structural layer operations (`"added"`, `"removed"`, `"reordered"`, etc.)
> are always accepted.

## VoxelCommandApplier — headless usage

`applyCommandToWorld` lets you replay hook events against a bare `VoxelWorld` without a
renderer. Useful for server-side logic, unit tests, or offline editing tools.

```ts
import { VoxelWorld, applyCommandToWorld } from "@jolly-pixel/voxel.renderer";

const world = new VoxelWorld(16);
applyCommandToWorld(world, {
  action: "added",
  layerName: "Ground",
  metadata: { options: {} }
});
applyCommandToWorld(world, {
  action: "voxel-set",
  layerName: "Ground",
  metadata: {
    position: { x: 0, y: 0, z: 0 },
    blockId: 1,
    rotation: 0,
    flipX: false,
    flipZ: false,
    flipY: false
  }
});
```
