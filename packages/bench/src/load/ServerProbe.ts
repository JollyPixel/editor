// Import Node.js Dependencies
import {
  PerformanceObserver,
  monitorEventLoopDelay,
  performance,
  type EventLoopUtilization
} from "node:perf_hooks";

// CONSTANTS
const kBytesPerMb = 1024 * 1024;

export interface ServerSample {
  cpuMs: number;
  elu: number;
  loopDelayP99Ms: number;
  heapUsedMb: number;
  rssMb: number;
  gcCount: number;
  gcPauseMs: number;
}

export class ServerProbe {
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
