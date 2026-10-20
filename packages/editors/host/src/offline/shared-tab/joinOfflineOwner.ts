// Import Third-party Dependencies
import { ChannelTransport } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { OfflineGuest } from "../OfflineGuest.ts";
import { OwnerMonitor } from "./OwnerMonitor.ts";
import {
  DISCOVERY_INTERVAL_MS,
  parseOwnerMessage,
  openBridgeChannel,
  openSocketChannel
} from "./protocol.ts";

export async function joinOfflineOwner(
  name: string,
  databaseName: string
): Promise<OfflineGuest> {
  const channel = openBridgeChannel(name);
  const tab = crypto.randomUUID();
  const subscriptions = new AbortController();
  const lost = Promise.withResolvers<void>();
  const monitor = new OwnerMonitor({
    channel,
    tab,
    lock: databaseName,
    onLost: lost.resolve
  });

  function release(): void {
    monitor.stop();
    subscriptions.abort();
    channel.close();
  }

  channel.addEventListener("message", (event) => {
    const message = parseOwnerMessage(event.data);
    if (message?.type === "owner" && message.tab === tab) {
      monitor.handle(message);
    }
  }, { signal: subscriptions.signal });

  let host: string;
  try {
    host = await monitor.discover();
  }
  catch (error) {
    release();

    throw error;
  }

  return new OfflineGuest({
    transport: new ChannelTransport({
      port: channel,
      host,
      socketPort: (socket) => openSocketChannel(name, socket)
    }),
    hostLost: lost.promise,
    onHostLost: () => {
      setTimeout(() => location.reload(), DISCOVERY_INTERVAL_MS);
    },
    onClose: release
  });
}
