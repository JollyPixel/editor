// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import { CHANNEL_TRANSPORT_TAG } from "#src/transport/channel.ts";
import {
  HOST_ID,
  SOCKET_EVENTS,
  type ChannelAction
} from "../transport/ChannelHarness.ts";

// CONSTANTS

const kSocket = fc.nat({ max: 7 });
const kData = fc.string({ unit: "binary", maxLength: 6 });
const kNoise = fc.oneof(
  fc.anything(),
  fc.record({
    tag: fc.constant(CHANNEL_TRANSPORT_TAG),
    host: fc.constantFrom("other-host", HOST_ID),
    socket: fc.constant("ghost"),
    type: fc.constantFrom("send", "close", "event"),
    event: fc.constantFrom(...SOCKET_EVENTS),
    data: fc.oneof(fc.string(), fc.constant({ data: "ghost" }))
  }),
  fc.record({
    tag: fc.constant(CHANNEL_TRANSPORT_TAG),
    host: fc.constant("other-host"),
    socket: fc.string({ maxLength: 4 }),
    type: fc.constant("connect"),
    dedicated: fc.boolean()
  })
);
export const channelAction: fc.Arbitrary<ChannelAction> = fc.oneof(
  { weight: 2, arbitrary: fc.constant({ type: "connect" as const }) },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constantFrom("client-send" as const, "server-send" as const),
      socket: kSocket,
      data: kData
    })
  },
  {
    weight: 2,
    arbitrary: fc.record({
      type: fc.constantFrom("server-open" as const, "client-close" as const),
      socket: kSocket
    })
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant("server-close" as const),
      socket: kSocket,
      code: fc.integer({ min: 1000, max: 4999 })
    })
  },
  {
    weight: 8,
    arbitrary: fc.record({
      type: fc.constant("deliver" as const),
      port: fc.nat({ max: 7 })
    })
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant("noise" as const),
      port: fc.nat(),
      message: kNoise
    })
  },
  {
    weight: 1,
    arbitrary: fc.constantFrom(
      { type: "transport-close" as const },
      { type: "host-close" as const }
    )
  }
);
export const channelSetup = fc.record({
  clientPorts: fc.boolean(),
  hostPorts: fc.boolean()
});
