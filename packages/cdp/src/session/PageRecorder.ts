// Import Node.js Dependencies
import {
  mkdirSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import type {
  Browser,
  CDPSession,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import { ProfileTree } from "../analysis/ProfileTree.ts";
import {
  GC_CATEGORIES,
  Trace,
  type GcSummary
} from "../analysis/Trace.ts";
import type { NetworkConditions } from "./emulation.ts";
import { MetricsDelta } from "./MetricsDelta.ts";
import { SocketTraffic } from "./SocketTraffic.ts";

// CONSTANTS
export const CPU_SAMPLING_INTERVAL_US = 200;
export const HEAP_SAMPLING = {
  samplingInterval: 16 * 1024,
  includeObjectsCollectedByMajorGC: true,
  includeObjectsCollectedByMinorGC: true
} as const;

export type Tracer = Pick<Browser, "startTracing" | "stopTracing">;

export interface PageRecorderOptions {
  cpuThrottle?: number;
  tracer?: Tracer;
}

export interface RecordingPlan {
  cpuProfile?: string;
  heapProfile?: string;
}

export interface MemoryRecording {
  heapProfileFile: string;
  allocatedBytes: number;
  gc: GcSummary;
}

export interface PageRecording {
  metrics: MetricsDelta;
  socketBytes: number;
  cpuProfileFile?: string;
  memory?: MemoryRecording;
}

export interface Recorded<T> {
  result: T;
  recording: PageRecording;
}

export class PageRecorder {
  readonly #cdp: CDPSession;
  readonly #traffic: SocketTraffic;
  readonly #tracer: Tracer | null;

  static async attach(
    page: Page,
    options: PageRecorderOptions = {}
  ): Promise<PageRecorder> {
    const { cpuThrottle = 1, tracer = null } = options;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    if (cpuThrottle > 1) {
      await cdp.send("Emulation.setCPUThrottlingRate", {
        rate: cpuThrottle
      });
    }

    return new PageRecorder(page, cdp, tracer);
  }

  constructor(
    page: Page,
    cdp: CDPSession,
    tracer: Tracer | null
  ) {
    this.#cdp = cdp;
    this.#traffic = new SocketTraffic(page);
    this.#tracer = tracer;
  }

  async emulateNetwork(
    conditions: NetworkConditions
  ): Promise<void> {
    await this.#cdp.send("Network.enable");
    await this.#cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      ...conditions
    });
  }

  async record<T>(
    plan: RecordingPlan,
    action: () => Promise<T>
  ): Promise<Recorded<T>> {
    const metricsBefore = await this.#metrics();
    const socketsBefore = this.#traffic.received;
    const stopMemory = plan.heapProfile === undefined ?
      null :
      await this.#startMemory(plan.heapProfile);
    const stopProfile = plan.cpuProfile === undefined ?
      null :
      await this.#startProfile(plan.cpuProfile);

    let result: T;
    let cpuProfileFile: string | undefined;
    let memory: MemoryRecording | undefined;
    try {
      result = await action();
    }
    finally {
      cpuProfileFile = await stopProfile?.();
      memory = await stopMemory?.();
    }

    return {
      result,
      recording: {
        metrics: new MetricsDelta(metricsBefore, await this.#metrics()),
        socketBytes: this.#traffic.received - socketsBefore,
        cpuProfileFile,
        memory
      }
    };
  }

  async #metrics(): Promise<Map<string, number>> {
    const { metrics } = await this.#cdp.send("Performance.getMetrics");

    return new Map(metrics.map(({ name, value }) => [name, value]));
  }

  async #startProfile(
    file: string
  ): Promise<() => Promise<string>> {
    await this.#cdp.send("Profiler.enable");
    await this.#cdp.send("Profiler.setSamplingInterval", {
      interval: CPU_SAMPLING_INTERVAL_US
    });
    await this.#cdp.send("Profiler.start");

    return async() => {
      const { profile } = await this.#cdp.send("Profiler.stop");
      await this.#cdp.send("Profiler.disable");
      writeJson(file, profile);

      return file;
    };
  }

  async #startMemory(
    file: string
  ): Promise<() => Promise<MemoryRecording>> {
    const tracer = this.#tracer;
    if (tracer === null) {
      throw new Error("Recording memory needs a tracer; a persistent context has none");
    }
    await tracer.startTracing(undefined, {
      categories: GC_CATEGORIES
    });
    await this.#cdp.send("HeapProfiler.enable");
    await this.#cdp.send("HeapProfiler.startSampling", HEAP_SAMPLING);

    return async() => {
      const { profile } = await this.#cdp.send("HeapProfiler.stopSampling");
      await this.#cdp.send("HeapProfiler.disable");
      const trace = Trace.parse((await tracer.stopTracing()).toString("utf8"));
      writeJson(file, profile);

      return {
        heapProfileFile: file,
        allocatedBytes: ProfileTree.fromHeapProfile(profile).total,
        gc: trace.garbageCollections()
      };
    };
  }
}

function writeJson(
  file: string,
  value: unknown
): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value));
}
