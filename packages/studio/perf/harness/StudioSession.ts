// Import Third-party Dependencies
import type {
  Browser,
  CDPSession
} from "@playwright/test";

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
import { SocketTraffic } from "./SocketTraffic.ts";
import type { StudioPage } from "./StudioPage.ts";

// CONSTANTS
const kSamplingIntervalUs = 200;
const kAllocationSamplingBytes = 16 * 1024;

export interface StudioSessionOptions extends StudioPageOptions {
  cpuThrottle: number;
}

export interface MemoryRecording {
  heapProfile: unknown;
  allocatedBytes: number;
  gc: GcSummary;
}

export class StudioSession {
  readonly studio: StudioPage;
  readonly traffic: SocketTraffic;
  readonly #cdp: CDPSession;
  readonly #browser: Browser;

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
    const session = new StudioSession(studio, cdp, bench.browser);
    await studio.open();

    return session;
  }

  constructor(
    studio: StudioPage,
    cdp: CDPSession,
    browser: Browser
  ) {
    this.studio = studio;
    this.traffic = new SocketTraffic(studio.page);
    this.#cdp = cdp;
    this.#browser = browser;
  }

  async metrics(): Promise<Map<string, number>> {
    const { metrics } = await this.#cdp.send("Performance.getMetrics");

    return new Map(metrics.map(({ name, value }) => [name, value]));
  }

  async startProfile(): Promise<void> {
    await this.#cdp.send("Profiler.enable");
    await this.#cdp.send("Profiler.setSamplingInterval", {
      interval: kSamplingIntervalUs
    });
    await this.#cdp.send("Profiler.start");
  }

  async stopProfile(): Promise<unknown> {
    const { profile } = await this.#cdp.send("Profiler.stop");
    await this.#cdp.send("Profiler.disable");

    return profile;
  }

  async startMemory(): Promise<void> {
    await this.#browser.startTracing(undefined, {
      categories: GC_CATEGORIES
    });
    await this.#cdp.send("HeapProfiler.enable");
    await this.#cdp.send("HeapProfiler.startSampling", {
      samplingInterval: kAllocationSamplingBytes,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true
    });
  }

  async stopMemory(): Promise<MemoryRecording> {
    const { profile } = await this.#cdp.send("HeapProfiler.stopSampling");
    await this.#cdp.send("HeapProfiler.disable");
    const trace = Trace.parse(
      (await this.#browser.stopTracing()).toString("utf8")
    );

    return {
      heapProfile: profile,
      allocatedBytes: ProfileTree.fromHeapProfile(profile).weights.total,
      gc: trace.garbageCollections()
    };
  }

  close(): Promise<void> {
    return this.studio.page.context().close();
  }
}
