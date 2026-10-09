// Import Internal Dependencies
import { Server } from "#src/index.ts";
import {
  ChannelTransport,
  ChannelTransportHost,
  type ChannelPort
} from "#src/transport/channel.ts";
import { LoopbackTransport } from "#src/transport/loopback.ts";
import { RecordingExtension } from "../server/RecordingExtension.ts";

export function createRelay(
  server = new Server()
) {
  const extension = new RecordingExtension("test-ns");
  server.register(extension);
  const channel = new MessageChannel();
  const loopback = new LoopbackTransport({ server });
  const host = new ChannelTransportHost({
    port: channel.port1,
    open: () => loopback.connect()
  });
  const transport = new ChannelTransport({
    port: channel.port2,
    host: host.id
  });

  return {
    extension,
    host,
    transport,
    [Symbol.dispose]: () => {
      transport.close();
      host.close();
      channel.port1.close();
      channel.port2.close();
    }
  };
}

export function createSocketRelay(
  sides = {
    host: true,
    client: true
  }
) {
  const server = new Server();
  const extension = new RecordingExtension("test-ns");
  server.register(extension);
  const shared = new MessageChannel();
  const sharedTypes: unknown[] = [];
  for (const port of [shared.port1, shared.port2]) {
    port.addEventListener("message", (event) => {
      sharedTypes.push((event.data as { type: unknown; }).type);
    });
    port.start();
  }
  const socketChannels = new Map<string, MessageChannel>();
  const closedPorts: string[] = [];
  function socketPort(
    side: "port1" | "port2"
  ) {
    return (socket: string): ChannelPort => {
      let channel = socketChannels.get(socket);
      if (channel === undefined) {
        channel = new MessageChannel();
        socketChannels.set(socket, channel);
      }
      const port = channel[side];
      const close = port.close.bind(port);
      port.close = () => {
        closedPorts.push(side);
        close();
      };

      return port;
    };
  }
  const loopback = new LoopbackTransport({ server });
  const host = new ChannelTransportHost({
    port: shared.port1,
    open: () => loopback.connect(),
    socketPort: sides.host ? socketPort("port1") : undefined
  });
  const transport = new ChannelTransport({
    port: shared.port2,
    host: host.id,
    socketPort: sides.client ? socketPort("port2") : undefined
  });

  return {
    extension,
    host,
    transport,
    sharedTypes,
    closedPorts,
    [Symbol.dispose]: () => {
      transport.close();
      host.close();
      shared.port1.close();
      shared.port2.close();
      for (const channel of socketChannels.values()) {
        channel.port1.close();
        channel.port2.close();
      }
    }
  };
}

export interface RecordingPort extends ChannelPort {
  posted: unknown[];
  deliver(data: unknown): void;
}

export function recordingPort(): RecordingPort {
  const listeners = new Set<(event: { data: unknown; }) => void>();
  const posted: unknown[] = [];

  return {
    posted,
    postMessage: (message) => posted.push(message),
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    deliver: (data) => {
      for (const listener of listeners) {
        listener({ data });
      }
    }
  };
}
