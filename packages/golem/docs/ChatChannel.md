# ChatChannel

`golem.chat` is the golem's side of the studio's golem chat, the `agent-chat` room people read and write in the chat pane. The golem joins it when it connects, so the pane lists it at once.

```ts
await golem.chat.say("Placing the forest", { assetId });
const messages = await golem.chat.next({ timeoutMs: 60_000 });
for (const { username, text } of messages) {
  console.log(`${username}: ${text}`);
}
```

Each message is an `AgentChatEntry` from `@jolly-pixel/server`: `id`, `clientId`, `peerId?`, `username`, `via?` (`"golem"` for an agent), `text`, `assetId?` and `at` (milliseconds since the epoch). The studio fills the author from the connection, never from the message.

## Properties

### `ready: Promise<void>`

Resolves once the studio sent the chat history. Rejects with `AgentChatRefusedError` when the owner's role may not join the chat.

### `unread: number`

How many messages from people `next` would return now.

## Methods

### `say(text, options?): Promise<AgentChatEntry>`

Writes in the chat and resolves with the message the studio relayed. `text` holds up to 4,000 characters and must not be blank; `options.assetId` names the asset the message is about.

Rejects with `AgentChatRefusedError` when the text is invalid, or when the owner's role can only read the chat.

### `next(options?): Promise<AgentChatEntry[]>`

Returns every message people wrote since the last call, oldest first. When there is none, it waits for one, or for `timeoutMs` (default `CHAT_NEXT_TIMEOUT_MS`, 30,000) and then returns an empty list. Messages from the golem itself and from other agents are left out, and so are those written before the golem connected.

`options.signal` stops the wait: `next` then rejects with the signal's reason.

### `dispose(): void`

Leaves the chat; a pending `next` returns what is unread. `golem.dispose()` calls it.
