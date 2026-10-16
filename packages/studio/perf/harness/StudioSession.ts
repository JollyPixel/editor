// Import Third-party Dependencies
import type { CDPSession } from "@playwright/test";

// Import Internal Dependencies
import type {
  BenchBrowser,
  StudioPageOptions
} from "./BenchBrowser.ts";
import { SocketTraffic } from "./SocketTraffic.ts";
import type { StudioPage } from "./StudioPage.ts";

// CONSTANTS
const kSamplingIntervalUs = 200;

export interface StudioSessionOptions extends StudioPageOptions {
  cpuThrottle: number;
}

export class StudioSession {
  readonly studio: StudioPage;
  readonly traffic: SocketTraffic;
  readonly #cdp: CDPSession;

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
    const session = new StudioSession(studio, cdp);
    await studio.open();

    return session;
  }

  constructor(
    studio: StudioPage,
    cdp: CDPSession
  ) {
    this.studio = studio;
    this.traffic = new SocketTraffic(studio.page);
    this.#cdp = cdp;
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

  close(): Promise<void> {
    return this.studio.page.context().close();
  }
}
