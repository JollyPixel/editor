# Sockets

## `recordSockets(page): string[]`

Collects the URL of every websocket the page opens after the call, except
Vite's HMR socket. The array fills as sockets open.

```ts
const sockets = recordSockets(page);
await openEditor(page, { query: { offline: "" } });
expect(sockets).toEqual([]);
```
