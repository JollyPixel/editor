// Import Node.js Dependencies
import type { Server } from "node:http";

// Import Internal Dependencies
import { ServerProbe } from "./ServerProbe.ts";
import type {
  ServerCommand,
  ServerEvent
} from "../protocol.ts";

export function loadServerConfig<TServerConfig>(): TServerConfig {
  return JSON.parse(process.argv[2]);
}

export function runLoadServer(
  httpServer: Server,
  close: () => void | Promise<void>
): void {
  const probe = new ServerProbe();

  process.on("message", (command: ServerCommand) => {
    if (command.type === "mark") {
      probe.mark();
    }
    else {
      reply({
        type: "sample",
        sample: probe.sample()
      });
    }
  });
  process.on("disconnect", () => void close());

  httpServer.listen(0, "127.0.0.1", () => {
    const address = httpServer.address();
    if (address !== null && typeof address === "object") {
      reply({
        type: "listening",
        port: address.port
      });
    }
  });
}

function reply(
  event: ServerEvent
): void {
  process.send?.(event);
}
