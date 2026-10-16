// Import Node.js Dependencies
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Import Internal Dependencies
import { BenchBrowser } from "./BenchBrowser.ts";
import type { BenchEditor } from "./BenchEditors.ts";
import {
  OpenSample,
  type OpenMeasurement,
  type OpenMemory,
  type OpenSampleData,
  type Phase
} from "./OpenSample.ts";
import { readProbe } from "./pageProbe.ts";
import type { StudioMode } from "./StudioPage.ts";
import { StudioSession } from "./StudioSession.ts";

// CONSTANTS
export const FOLLOW_UP_PHASES = ["reopen", "reload", "cold"] as const;
export const DEFAULT_SETTLE_MS = 4_000;

export type FollowUpPhase = typeof FOLLOW_UP_PHASES[number];

export interface OpenRunOptions {
  label: string;
  runs: number;
  editors: readonly BenchEditor[];
  modes: readonly StudioMode[];
  phases: ReadonlySet<FollowUpPhase>;
  storage: Record<string, string>;
  prewarm: boolean;
  headless: boolean;
  cpuThrottle: number;
  settleMs: number;
  profileDir: string | null;
  memoryDir: string | null;
  base: string;
}

export class OpenRun {
  readonly options: OpenRunOptions;

  constructor(
    options: OpenRunOptions
  ) {
    this.options = options;
    for (const dir of [options.profileDir, options.memoryDir]) {
      if (dir !== null) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  async* measure(): AsyncGenerator<OpenMeasurement> {
    for (let run = 0; run < this.options.runs; run++) {
      for (const mode of this.#shuffled(this.options.modes)) {
        for (const editor of this.#shuffled(this.options.editors)) {
          const bench = await BenchBrowser.launch({
            headless: this.options.headless
          });

          try {
            yield* this.#measureEditor(
              bench, mode, editor, run
            );
          }
          catch (error) {
            console.error(`${run} ${mode} ${editor.name} failed`, error);
          }
          finally {
            await bench.close();
          }
        }
      }
    }
  }

  async* #measureEditor(
    bench: BenchBrowser,
    mode: StudioMode,
    editor: BenchEditor,
    run: number
  ): AsyncGenerator<OpenMeasurement> {
    const { phases } = this.options;
    const session = await this.#startSession(bench, mode);
    yield await this.#measureOpen(session, editor, "first", run);

    if (phases.has("reopen")) {
      await session.studio.closeEditor(editor);
      yield await this.#measureOpen(session, editor, "reopen", run);
    }
    if (phases.has("reload")) {
      await session.studio.reopenWithoutTabs();
      yield await this.#measureOpen(session, editor, "reload", run);
    }
    await session.close();

    if (phases.has("cold")) {
      const cold = await this.#startSession(bench, mode);
      yield await this.#measureOpen(cold, editor, "cold", run);
      await cold.close();
    }
  }

  #startSession(
    bench: BenchBrowser,
    mode: StudioMode
  ): Promise<StudioSession> {
    return StudioSession.start(bench, {
      base: this.options.base,
      mode,
      storage: this.options.storage,
      prewarm: this.options.prewarm,
      probe: true,
      cpuThrottle: this.options.cpuThrottle
    });
  }

  async #measureOpen(
    session: StudioSession,
    editor: BenchEditor,
    phase: Phase,
    run: number
  ): Promise<OpenMeasurement> {
    const { label, settleMs, profileDir, memoryDir } = this.options;
    const { studio, traffic } = session;
    const { mode } = studio;
    const fileStem = `${label}-${mode}-${editor.name}-${phase}-${run}`;
    await studio.waitUntilOpenable(editor);

    const metricsBefore = await session.metrics();
    const socketsBefore = traffic.received;
    if (profileDir !== null) {
      await session.startProfile();
    }
    if (memoryDir !== null) {
      await session.startMemory();
    }
    const frame = await studio.openEditor(editor);
    await studio.page.waitForTimeout(settleMs);

    let profileFile: string | undefined;
    if (profileDir !== null) {
      profileFile = path.join(profileDir, `${fileStem}.cpuprofile`);
      writeFileSync(profileFile, JSON.stringify(await session.stopProfile()));
    }
    let memory: OpenSampleData["memory"];
    if (memoryDir !== null) {
      const recording = await session.stopMemory();
      const heapProfileFile = path.join(memoryDir, `${fileStem}.heapprofile`);
      writeFileSync(heapProfileFile, JSON.stringify(recording.heapProfile));
      memory = {
        ...recording,
        heapProfileFile
      };
    }

    const metricsAfter = await session.metrics();
    const sample = new OpenSample({
      shell: await studio.page.evaluate(readProbe),
      frame: await frame.evaluate(readProbe),
      metricsBefore,
      metricsAfter,
      socketBytes: traffic.received - socketsBefore,
      settleMs,
      memory
    });
    const measurement = sample.toMeasurement({
      label,
      run,
      mode,
      editor: editor.name,
      phase,
      profileFile
    });
    console.log(
      `${run} ${mode.padEnd(7)} ${editor.name.padEnd(11)} ${phase.padEnd(6)}`,
      `ready ${measurement.clickToReady} settled ${measurement.clickToSettled}`,
      `busy ${measurement.framesBeforeReady.total}/${measurement.framesAfterReady.total}`,
      `xfer ${measurement.transferKB}KB ws ${measurement.socketKB}KB`,
      memorySummary(measurement.memory)
    );

    return measurement;
  }

  #shuffled<T>(
    items: readonly T[]
  ): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }

    return copy;
  }
}

function memorySummary(
  memory: OpenMemory | undefined
): string {
  if (memory === undefined) {
    return "";
  }
  const { allocatedMB, minorGc, majorGc } = memory;

  return `alloc ${allocatedMB}MB gc ${minorGc.ms}/${majorGc.ms}ms`;
}
