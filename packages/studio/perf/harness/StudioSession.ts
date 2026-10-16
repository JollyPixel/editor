// Import Node.js Dependencies
import {
  mkdirSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import type { CDPSession } from "@playwright/test";

// Import Internal Dependencies
import { ProfileTree } from "../analysis/ProfileTree.ts";
import {
  GC_CATEGORIES,
  Trace,
  type GcSummary
} from "../analysis/Trace.ts";
import type {
  BenchBrowser,
  StudioPageOptions
} from "./BenchBrowser.ts";
import { MetricsDelta } from "./MetricsDelta.ts";
import { SocketTraffic } from "./SocketTraffic.ts";
import type { StudioPage } from "./StudioPage.ts";
import type { NetworkConditions } from "./flags.ts";

// CONSTANTS
export const CPU_SAMPLING_INTERVAL_US = 200;
export const HEAP_SAMPLING = {
  samplingInterval: 16 * 1024,
  includeObjectsCollectedByMajorGC: true,
  includeObjectsCollectedByMinorGC: true
} as const;

export interface StudioSessionOptions extends StudioPageOptions {
  cpuThrottle: number;
  network?: NetworkConditions;
}

export interface RecordingFiles {
  cpuProfile?: string;
  heapProfile?: string;
}

export interface MemoryRecording {
  heapProfileFile: string;
  allocatedBytes: number;
  gc: GcSummary;
}

export interface SessionRecording {
  metrics: MetricsDelta;
  socketBytes: number;
  cpuProfileFile?: string;
  memory?: MemoryRecording;
}

export interface Recorded<T> {
  result: T;
  recording: SessionRecording;
}

export class StudioSession {
  readonly studio: StudioPage;
  readonly traffic: SocketTraffic;
  readonly #cdp: CDPSession;
  readonly #bench: BenchBrowser;

  static async start(
    bench: BenchBrowser,
    options: StudioSessionOptions
  ): Promise<StudioSession> {
    const studio = await bench.newStudioPage(options);
    const cdp = await studio.page.context().newCDPSession(studio.page);
    await cdp.send("Performance.enable");
    if (options.cpuThrottle > 1) {
      await cdp.send("Emulation.setCPUThrottlingRate", {
        rate: options.cpuThrottle
      });
    }
    const session = new StudioSession(studio, cdp, bench);
    await studio.open();
    if (options.network !== undefined) {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        ...options.network
      });
    }

    return session;
  }

  constructor(
    studio: StudioPage,
    cdp: CDPSession,
    bench: BenchBrowser
  ) {
    this.studio = studio;
    this.traffic = new SocketTraffic(studio.page);
    this.#cdp = cdp;
    this.#bench = bench;
  }

  async record<T>(
    files: RecordingFiles,
    action: () => Promise<T>
  ): Promise<Recorded<T>> {
    const metricsBefore = await this.#metrics();
    const socketsBefore = this.traffic.received;
    if (files.cpuProfile !== undefined) {
      await this.#startProfile();
    }
    if (files.heapProfile !== undefined) {
      await this.#startMemory();
    }

    const result = await action();

    const cpuProfileFile = files.cpuProfile === undefined ?
      undefined :
      await this.#stopProfile(files.cpuProfile);
    const memory = files.heapProfile === undefined ?
      undefined :
      await this.#stopMemory(files.heapProfile);

    return {
      result,
      recording: {
        metrics: new MetricsDelta(metricsBefore, await this.#metrics()),
        socketBytes: this.traffic.received - socketsBefore,
        cpuProfileFile,
        memory
      }
    };
  }

  close(): Promise<void> {
    return this.studio.page.context().close();
  }

  async #metrics(): Promise<Map<string, number>> {
    const { metrics } = await this.#cdp.send("Performance.getMetrics");

    return new Map(metrics.map(({ name, value }) => [name, value]));
  }

  async #startProfile(): Promise<void> {
    await this.#cdp.send("Profiler.enable");
    await this.#cdp.send("Profiler.setSamplingInterval", {
      interval: CPU_SAMPLING_INTERVAL_US
    });
    await this.#cdp.send("Profiler.start");
  }

  async #stopProfile(
    file: string
  ): Promise<string> {
    const { profile } = await this.#cdp.send("Profiler.stop");
    await this.#cdp.send("Profiler.disable");
    writeJson(file, profile);

    return file;
  }

  async #startMemory(): Promise<void> {
    await this.#bench.browser.startTracing(undefined, {
      categories: GC_CATEGORIES
    });
    await this.#cdp.send("HeapProfiler.enable");
    await this.#cdp.send("HeapProfiler.startSampling", HEAP_SAMPLING);
  }

  async #stopMemory(
    file: string
  ): Promise<MemoryRecording> {
    const { profile } = await this.#cdp.send("HeapProfiler.stopSampling");
    await this.#cdp.send("HeapProfiler.disable");
    const trace = Trace.parse(
      (await this.#bench.browser.stopTracing()).toString("utf8")
    );
    writeJson(file, profile);

    return {
      heapProfileFile: file,
      allocatedBytes: ProfileTree.totalAllocated(profile),
      gc: trace.garbageCollections()
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
