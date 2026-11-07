// Import Third-party Dependencies
import {
  PageRecorder,
  type NetworkConditions,
  type Recorded,
  type RecordingPlan
} from "@jolly-pixel/cdp";

// Import Internal Dependencies
import type {
  BenchBrowser,
  StudioPageOptions
} from "./BenchBrowser.ts";
import type { StudioPage } from "./StudioPage.ts";

export interface StudioSessionOptions extends StudioPageOptions {
  cpuThrottle: number;
  network?: NetworkConditions;
}

export class StudioSession {
  readonly studio: StudioPage;
  readonly #recorder: PageRecorder;

  static async start(
    bench: BenchBrowser,
    options: StudioSessionOptions
  ): Promise<StudioSession> {
    const studio = await bench.newStudioPage(options);
    const recorder = await PageRecorder.attach(studio.page, {
      cpuThrottle: options.cpuThrottle,
      tracer: bench.tracer
    });
    const session = new StudioSession(studio, recorder);
    await studio.open();
    if (options.network !== undefined) {
      await recorder.emulateNetwork(options.network);
    }

    return session;
  }

  constructor(
    studio: StudioPage,
    recorder: PageRecorder
  ) {
    this.studio = studio;
    this.#recorder = recorder;
  }

  record<T>(
    plan: RecordingPlan,
    action: () => Promise<T>
  ): Promise<Recorded<T>> {
    return this.#recorder.record(plan, action);
  }

  close(): Promise<void> {
    return this.studio.page.context().close();
  }
}
