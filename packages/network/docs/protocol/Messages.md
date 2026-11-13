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

`commandUnion<TCommand>(variants)` joins header-less variants into one schema
typed as `TCommand`, for command lists built from a table where zod cannot
infer the union.

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

### Bytes

`bytesSchema` accepts a `Uint8Array`. A message that holds one travels as a
[binary frame](#frames), and the receiver gets each array back as a view of the
frame it received.

```ts
import { bytesSchema } from "@jolly-pixel/network/client";

const snapshot = z.object({ content: bytesSchema });
```

Use this schema instance rather than `z.instanceof(Uint8Array)`: Node turns it
into a validator keyword, and building the JSON Schema of any other
`z.instanceof` schema throws.

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

## Frames

`encodeFrame(value)` returns the JSON text of `value`, or a binary `Frame`
when `value` holds a `Uint8Array`. It throws what `JSON.stringify` throws, and
`PlaceholderCollisionError` for an object whose only key is `"$bytes"`.
`Envelope.encode(envelope)` returns those failures as `Err` with the message.

`decodeFrame(frame, parseJson?)` reads a string, a `Uint8Array` or an
`ArrayBuffer`. `parseJson` defaults to `JSON.parse`. It returns `Err` with
`{ reason: "invalid-json" | "invalid-frame", message }`. It accepts only what
`encodeFrame` can produce, so a decoded value always encodes again.

`encodedLength(value)` is the JSON length of `value`, counting each
`Uint8Array` by its byte length. The server measures profiles and presence with
it.

A binary frame, with integers in little endian:

```
u8   version, 1
u32  header length
u32  attachment count n
n ×  u32 attachment length
header: UTF-8 JSON of the value, each Uint8Array replaced by {"$bytes": index}
each attachment, starting on a multiple of 8 bytes from the frame start
```

A placeholder is an object whose only key is `"$bytes"`. Its value must be the
index of an attachment, and each attachment needs exactly one placeholder; an
object with other keys besides `"$bytes"` stays an object. A text frame has no
attachments, so any placeholder in it is an `invalid-frame`.

## Parsing

Root exports `MessageParser` and `SchemaParser`; `/client` omits them.
Parsing returns `Ok` or `Err`. `SchemaParser.is(value)` checks a value without
collecting errors. `MessageParser.fromProtocol` caches per protocol object.
`identify(payload)` returns the event the payload's tags name without
validating it, or `null` when no single variant matches them.

Invalid inbound messages produce `error`; invalid outbound messages are dropped,
unless the server sets `validateOutbound: false` ([Server](../server/Server.md)).
A client's room parser emits `malformed`. Type annotations alone do not validate.
