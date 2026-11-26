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
  TIMELINE_CATEGORIES,
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
  trace?: string;
}

export interface MemoryRecording {
  heapProfileFile: string;
  allocatedBytes: number;
  gc: GcSummary;
}

export interface PageRecording {
  metrics: MetricsDelta;
  socketBytes: number;
  socketSentBytes: number;
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
    if (plan.heapProfile !== undefined && plan.trace !== undefined) {
      throw new Error("A heap profile and a trace cannot share one tracer; record them apart");
    }
    const metricsBefore = await this.#metrics();
    const receivedBefore = this.#traffic.received;
    const sentBefore = this.#traffic.sent;
    const stopMemory = plan.heapProfile === undefined ?
      null :
      await this.#startMemory(plan.heapProfile);
    const stopTrace = plan.trace === undefined ?
      null :
      await this.#startTrace(plan.trace);
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
      await stopTrace?.();
      memory = await stopMemory?.();
    }

    return {
      result,
      recording: {
        metrics: new MetricsDelta(metricsBefore, await this.#metrics()),
        socketBytes: this.#traffic.received - receivedBefore,
        socketSentBytes: this.#traffic.sent - sentBefore,
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
      writeOut(file, JSON.stringify(profile));

      return file;
    };
  }

  async #startTrace(
    file: string
  ): Promise<() => Promise<void>> {
    const tracer = this.#requireTracer("a trace");
    await tracer.startTracing(undefined, {
      categories: TIMELINE_CATEGORIES
    });

    return async() => {
      writeOut(file, await tracer.stopTracing());
    };
  }

  async #startMemory(
    file: string
  ): Promise<() => Promise<MemoryRecording>> {
    const tracer = this.#requireTracer("memory");
    await tracer.startTracing(undefined, {
      categories: GC_CATEGORIES
    });
    await this.#cdp.send("HeapProfiler.enable");
    await this.#cdp.send("HeapProfiler.startSampling", HEAP_SAMPLING);

    return async() => {
      const { profile } = await this.#cdp.send("HeapProfiler.stopSampling");
      await this.#cdp.send("HeapProfiler.disable");
      const trace = Trace.parse((await tracer.stopTracing()).toString("utf8"));
      writeOut(file, JSON.stringify(profile));

      return {
        heapProfileFile: file,
        allocatedBytes: ProfileTree.fromHeapProfile(profile).total,
        gc: trace.garbageCollections()
      };
    };
  }

  #requireTracer(
    recording: string
  ): Tracer {
    if (this.#tracer === null) {
      throw new Error(`Recording ${recording} needs a tracer; a persistent context has none`);
    }

    return this.#tracer;
  }
}

function writeOut(
  file: string,
  data: string | Buffer
): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
}
