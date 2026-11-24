// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Server } from "#src/index.ts";
import { ChannelTransportHost } from "#src/transport/channel/ChannelTransportHost.ts";
import {
  CHANNEL_TRANSPORT_TAG,
  parseChannelMessage
} from "#src/transport/channel/ChannelMessage.ts";
import { LoopbackTransport } from "#src/transport/loopback/LoopbackTransport.ts";
import { recordingPort } from "../../helpers/transport/channelRelay.ts";

describe("ChannelTransportHost — relays", () => {
  test("the host keeps the first relay of a socket id connected twice", () => {
    const port = recordingPort();
    let opened = 0;
    const host = new ChannelTransportHost({
      port,
      id: "host-a",
      open: () => {
        opened++;

        return new LoopbackTransport({ server: new Server() }).connect();
      }
    });
    const connect = {
      tag: CHANNEL_TRANSPORT_TAG,
      host: "host-a",
      type: "connect",
      socket: "s1",
      dedicated: false
    };

    port.deliver(connect);
    port.deliver(connect);
    assert.strictEqual(opened, 1);

    host.close();
  });

  test("the host closes a socket past its relay limit with code 1013", () => {
    const port = recordingPort();
    let opened = 0;
    const host = new ChannelTransportHost({
      port,
      id: "host-a",
      maxRelays: 1,
      open: () => {
        opened++;

        return new LoopbackTransport({ server: new Server() }).connect();
      }
    });
    for (const socket of ["s1", "s2"]) {
      port.deliver({
        tag: CHANNEL_TRANSPORT_TAG,
        host: "host-a",
        type: "connect",
        socket,
        dedicated: false
      });
    }

    assert.strictEqual(opened, 1);
    const closed = port.posted
      .map(parseChannelMessage)
      .find((message) => message?.socket === "s2");
    assert.deepEqual(closed?.type === "event" && closed.data, {
      code: 1013,
      reason: "The channel transport host relays too many sockets."
    });
    host.close();
  });
});
