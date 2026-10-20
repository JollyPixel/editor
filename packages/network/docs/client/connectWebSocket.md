# connectWebSocket

Open a client socket to a [`WebsocketTransport`](../server/WebsocketTransport.md).
`Client` uses it when no `socket` factory is given.

```ts
import { Client, connectWebSocket } from "@jolly-pixel/network/client";

const client = new Client({
  socket: () => connectWebSocket({ credential: "secret" })
});
```

## `connectWebSocket(options?): ClientSocket`

```ts
interface WebSocketConnectOptions {
  url?: string;
  credential?: string;
}
```

Default URL uses the page host and `/ws-sync`; supply it explicitly in Node.
The `credential` travels in the WebSocket handshake, where the transport
decodes it for the [authentication provider](../server/Access.md#authentication).
