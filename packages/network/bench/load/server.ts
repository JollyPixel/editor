// Import Node.js Dependencies
import http from "node:http";
import {
  PerformanceObserver,
  monitorEventLoopDelay,
  performance,
  type EventLoopUtilization
} from "node:perf_hooks";

// Import Internal Dependencies
import {
  EchoExtension,
  GATED_RIGHTS,
  silentLogger
} from "../_fixtures.ts";
import {
  roomName,
  type ServerCommand,
  type LoadServerConfig,
  type ServerEvent,
  type ServerSample
} from "./protocol.ts";
import {
  DEFAULT_WEBSOCKET_PATH,
  Server
} from "../../src/index.ts";
import { WebsocketTransport } from "../../src/node.ts";

// CONSTANTS
const kBytesPerMb = 1024 * 1024;

class ServerProbe {
  #loopDelay = monitorEventLoopDelay({ resolution: 1 });
  #gcCount = 0;
  #gcPauseMs = 0;
  #cpu = process.cpuUsage();
  #elu: EventLoopUtilization = performance.eventLoopUtilization();

  constructor() {
    this.#loopDelay.enable();
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.#gcCount++;
        this.#gcPauseMs += entry.duration;
      }
    }).observe({ entryTypes: ["gc"] });
  }

  mark(): void {
    this.#loopDelay.reset();
    this.#gcCount = 0;
    this.#gcPauseMs = 0;
    this.#cpu = process.cpuUsage();
    this.#elu = performance.eventLoopUtilization();
  }

  sample(): ServerSample {
    const cpu = process.cpuUsage(this.#cpu);
    const memory = process.memoryUsage();

    return {
      cpuMs: (cpu.user + cpu.system) / 1_000,
      elu: performance.eventLoopUtilization(this.#elu).utilization,
      loopDelayP99Ms: this.#loopDelay.percentile(99) / 1e6,
      heapUsedMb: memory.heapUsed / kBytesPerMb,
      rssMb: memory.rss / kBytesPerMb,
      gcCount: this.#gcCount,
      gcPauseMs: this.#gcPauseMs
    };
  }
}

const config: LoadServerConfig = JSON.parse(process.argv[2]);
const server = new Server({
  logger: silentLogger(),
  ...(config.rights ? {
    rights: GATED_RIGHTS,
    defaultRole: "editor"
  } : {})
});
for (let index = 0; index < config.rooms; index++) {
  server.register(new EchoExtension({
    variants: config.variants,
    roomId: roomName(index),
    snapshotBytes: config.snapshotBytes
  }));
}

const httpServer = http.createServer();
const transport = new WebsocketTransport({
  path: DEFAULT_WEBSOCKET_PATH,
  httpServer,
  server,
  compression: config.compression,
  heartbeatMs: 0
});
const probe = new ServerProbe();

process.on("message", (message: ServerCommand) => {
  if (message.type === "mark") {
    probe.mark();
  }
  else {
    reply({
      type: "sample",
      sample: probe.sample()
    });
  }
});
process.on("disconnect", () => {
  transport[Symbol.dispose]();
  httpServer.close();
  void server.close();
});

httpServer.listen(0, "127.0.0.1", () => {
  const address = httpServer.address();
  if (address !== null && typeof address === "object") {
    reply({
      type: "listening",
      port: address.port
    });
  }
});

function reply(
  message: ServerEvent
): void {
  process.send?.(message);
}
