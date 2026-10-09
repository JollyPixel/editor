# Getting started

Mount an echo room on Vite, then open two browser tabs to exchange messages.

## Host a room

In `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import { PresenceOnlyExtension } from "@jolly-pixel/network";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/node";

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
        new PresenceOnlyExtension("echo", "echo", { broadcast: true })
      ]
    })
  ]
});
```

This relay accepts opaque messages. Permissions require explicit
[protocols](../protocol/Messages.md) and [access rules](../server/Access.md).

## Connect and join

```ts
import { Client } from "@jolly-pixel/network/client";

const client = new Client();
const room = client.room("echo");
room.on("message", (payload) => console.log(payload));
room.on("sync", () => room.send({ text: "Hello" }));
room.join();
```

`sync` confirms admission. The relay sends to every member, including the sender.
Use `room.updatePresence({ tool: "brush" })` to share activity separately.

## Cleanup

Call `room.leave()` when the feature closes and `client.destroy()` when finished.
Applications hosting a server also await `server.close()`.

See [Client](../client/Client.md) and [Transports](../transport/Transports.md).
