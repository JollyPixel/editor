# Messages

Protocols describe payloads and name events for rights checks.

```ts
import { MessageProtocol } from "@jolly-pixel/network/client";

const commands = new MessageProtocol({
  type: "object",
  properties: { action: { const: "clear" } },
  required: ["action"]
});
```

## MessageProtocol

`MessageProtocol`
defines schemas and event names for feature messages.

### Constructor

`new MessageProtocol(schema, options?)` accepts one schema or a union.
Events use `title` or a required discriminator `const` (default `action`).

### Types

`InferMessage<typeof protocol>` derives the payload type. `MessageProtocols`
pairs inbound/outbound protocols.

### OPAQUE_PROTOCOLS / NO_MESSAGE_PROTOCOLS

Opaque protocols skip validation; no-message protocols accept no feature messages.

## Command schemas

### commandVariant / withCommandHeader

Build command schemas and add stamped headers.

### serverMessageProtocol

Wraps commands, corrections, snapshots, and catch-up. `acks` tracks processed
sequences; `refused` names a rejected local sequence.

## Parsing

Root exports `MessageParser` and `SchemaParser`; `/client` omits them.
Parsing returns `Ok` or `Err`. `MessageParser.of` caches per protocol object.

Invalid inbound messages produce `error`; invalid outbound messages are dropped.
A client's room parser emits `malformed`. Type annotations alone do not validate.
