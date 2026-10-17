# Messages

Protocols describe payloads and name events for rights checks. Schemas are
written with `zod/mini`.

```ts
import * as z from "zod/mini";
import { MessageProtocol } from "@jolly-pixel/network/client";

const commands = new MessageProtocol(z.object({
  action: z.literal("clear")
}));
```

## MessageProtocol

`MessageProtocol`
defines schemas and event names for feature messages.

### Constructor

`new MessageProtocol(schema, options?)` accepts one schema or a union.
A variant's event is the name `withEvent(schema, event)` gave it, else its
required discriminator literal (default `action`).

### withEvent

`withEvent(schema, event)` names the event of a variant whose discriminator
literal is not its event, and returns the same schema:

```ts
import { withEvent } from "@jolly-pixel/network/client";

const deleted = withEvent(z.object({
  type: z.literal("deleted")
}), "$deleted");
```

### Types

`InferMessage<typeof protocol>` derives the payload type. `MessageProtocols`
pairs inbound/outbound protocols.

### OPAQUE_PROTOCOLS / NO_MESSAGE_PROTOCOLS

Opaque protocols skip validation; no-message protocols accept no feature messages.

## Command schemas

### commandVariant / withCommandHeader

`commandVariant(action, shape)` builds a command object schema;
`withCommandHeader(variant)` adds the stamped header fields.

### serverMessageProtocol

Wraps commands, corrections, snapshots, and catch-up. `acks` tracks processed
sequences; `refused` names a rejected local sequence.

## Schemas

A schema is a zod schema without transforms or defaults: parsers return the
value they were given, not zod's output.

Node validates with ata-validator, on the JSON Schema that `z.toJSONSchema`
emits. Browsers validate with zod, and switch to schemas compiled by
`z.compile` once the compiler has loaded. Both report errors as
`ValidationError`:

```ts
interface ValidationError {
  readonly instancePath: string;
  readonly message: string;
}
```

`isSchema(value)` tells a zod schema from any other value.

### Rules

zod cannot emit these rules as JSON Schema keywords. Each helper adds the zod
check and the keyword, and returns the schema:

- `minProperties(schema, min)`: at least `min` properties.
- `dependentRequired(schema, { from: ["content"] })`: `from` requires
  `content`.
- `requireAnyGroup(schema, [["src", "tileSize"], ["asset"]])`: every key of one
  group at least.
- `notMultiple(schema, divisor)`: a number that `divisor` does not divide.

```ts
import { minProperties } from "@jolly-pixel/network";

const faces = minProperties(z.record(z.string(), z.number()), 1);
```

## Parsing

Root exports `MessageParser` and `SchemaParser`; `/client` omits them.
Parsing returns `Ok` or `Err`. `SchemaParser.is(value)` checks a value without
collecting errors. `MessageParser.fromProtocol` caches per protocol object.
`identify(payload)` returns the event the payload's tags name without
validating it, or `null` when no single variant matches them.

Invalid inbound messages produce `error`; invalid outbound messages are dropped,
unless the server sets `validateOutbound: false` ([Server](../server/Server.md)).
A client's room parser emits `malformed`. Type annotations alone do not validate.
