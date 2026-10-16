// Import Node.js Dependencies
import { tmpdir } from "node:os";
import path from "node:path";

// Import Internal Dependencies
import { alternatingRounds } from "./alternatingRounds.ts";
import { BenchBrowser } from "./BenchBrowser.ts";
import type {
  BenchEditor,
  BenchEditors
} from "./BenchEditors.ts";
import {
  DEFAULT_SETTLE_MS,
  NETWORK_FLAG,
  type NetworkConditions
} from "./flags.ts";
import type {
  OpenPlan,
  OpenVariant
} from "./OpenPlan.ts";
import {
  OpenSample,
  type OpenMeasurement,
  type OpenMemory,
  type Phase
} from "./OpenSample.ts";
import { readProbe } from "./openProbe.ts";
import type { StudioMode } from "./StudioPage.ts";
import { StudioSession } from "./StudioSession.ts";

// CONSTANTS
export const OPEN_RUN_OPTIONS = {
  headless: { type: "boolean", default: false },
  cpu: { type: "string", default: "1" },
  network: { type: "string" },
  settle: { type: "string", default: String(DEFAULT_SETTLE_MS) },
  profile: { type: "string" },
  memory: { type: "string" }
} as const;

export interface OpenRunFlags {
  headless: boolean;
  cpu: string;
  network?: string;
  settle: string;
  profile?: string;
  memory?: string;
}

export interface OpenRunSettings {
  headless: boolean;
  cpuThrottle: number;
  network?: NetworkConditions;
  settleMs: number;
  profileDir: string | null;
  memoryDir: string | null;
}

interface OpenCell {
  round: number;
  variant: OpenVariant;
  mode: StudioMode;
  editor: BenchEditor;
}

export class OpenRun {
  readonly #plan: OpenPlan;
  readonly #editors: readonly BenchEditor[];
  readonly #settings: OpenRunSettings;

  static settingsFrom(
    flags: OpenRunFlags
  ): OpenRunSettings {
    return {
      headless: flags.headless,
      cpuThrottle: Number(flags.cpu),
      network: flags.network === undefined ?
        undefined :
        NETWORK_FLAG.parse(flags.network),
      settleMs: Number(flags.settle),
      profileDir: flags.profile ?? null,
      memoryDir: flags.memory ?? null
    };
  }

  constructor(
    plan: OpenPlan,
    editors: BenchEditors,
    settings: OpenRunSettings
  ) {
    this.#plan = plan;
    this.#editors = editors.select(plan.editors);
    this.#settings = settings;
  }

  async* measure(
    rounds: number
  ): AsyncGenerator<OpenMeasurement> {
    for (const { round, item: variant } of alternatingRounds(this.#plan.variants, rounds)) {
      console.log(`round ${round} ${variant.label}`);
      for (const mode of shuffled(this.#plan.modes)) {
        for (const editor of shuffled(this.#editors)) {
          const bench = await BenchBrowser.launch({
            headless: this.#settings.headless
          });

          try {
            yield* this.#measureEditor(bench, {
              round,
              variant,
              mode,
              editor
            });
          }
          catch (error) {
            console.error(`${round} ${variant.label} ${mode} ${editor.name} failed`, error);
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
    cell: OpenCell
  ): AsyncGenerator<OpenMeasurement> {
    const { phases } = this.#plan;
    const session = await this.#startSession(bench, cell);
    yield await this.#measureOpen(session, cell, "first");

    if (phases.has("reopen")) {
      await session.studio.closeEditor(cell.editor);
      yield await this.#measureOpen(session, cell, "reopen");
    }
    if (phases.has("reload")) {
      await session.studio.reopenWithoutTabs();
      yield await this.#measureOpen(session, cell, "reload");
    }
    await session.close();

    if (phases.has("cold")) {
      const cold = await this.#startSession(bench, cell);
      yield await this.#measureOpen(cold, cell, "cold");
      await cold.close();
    }
    if (phases.has("restart")) {
      yield await this.#measureRestart(cell);
    }
  }

  async #measureRestart(
    cell: OpenCell
  ): Promise<OpenMeasurement> {
    const { variant, mode, editor } = cell;
    const profile = {
      userDataDir: path.join(
        tmpdir(),
        "jolly-pixel-perf",
        `${variant.label}-${mode}-${editor.name}`
      ),
      base: variant.base,
      headless: this.#settings.headless
    };

    const primer = await BenchBrowser.launchPersistent(profile);
    try {
      const { studio } = await this.#startSession(primer, cell);
      await studio.waitUntilOpenable(editor);
      await studio.openEditor(editor);
      await studio.page.waitForTimeout(this.#settings.settleMs);
      await studio.closeEditor(editor);
    }
    finally {
      await primer.close();
    }

    const restarted = await BenchBrowser.launchPersistent(profile);
    try {
      const session = await this.#startSession(restarted, cell);

      return await this.#measureOpen(session, cell, "restart");
    }
    finally {
      await restarted.close();
    }
  }

  #startSession(
    bench: BenchBrowser,
    { variant, mode }: OpenCell
  ): Promise<StudioSession> {
    return StudioSession.start(bench, {
      base: variant.base,
      mode,
      storage: variant.storage,
      prewarm: variant.prewarm,
      probe: true,
      cpuThrottle: this.#settings.cpuThrottle,
      network: this.#settings.network
    });
  }

  async #measureOpen(
    session: StudioSession,
    { round, variant, mode, editor }: OpenCell,
    phase: Phase
  ): Promise<OpenMeasurement> {
    const { settleMs, profileDir, memoryDir } = this.#settings;
    const { studio } = session;
    const fileStem = `${variant.label}-${mode}-${editor.name}-${phase}-${round}`;
    await studio.waitUntilOpenable(editor);

    const { result: frame, recording } = await session.record(
      {
        cpuProfile: fileIn(profileDir, `${fileStem}.cpuprofile`),
        heapProfile: fileIn(memoryDir, `${fileStem}.heapprofile`)
      },
      async() => {
        const frame = await studio.openEditor(editor);
        await studio.page.waitForTimeout(settleMs);

        return frame;
      }
    );

    const sample = new OpenSample({
      shell: await studio.page.evaluate(readProbe),
      frame: await frame.evaluate(readProbe),
      recording,
      settleMs
    });
    const measurement = sample.toMeasurement({
      label: variant.label,
      run: round,
      mode,
      editor: editor.name,
      phase
    });
    console.log(
      `${round} ${mode.padEnd(7)} ${editor.name.padEnd(11)} ${phase.padEnd(6)}`,
      `ready ${measurement.clickToReady} settled ${measurement.clickToSettled}`,
      `busy ${measurement.framesBeforeReady.total}/${measurement.framesAfterReady.total}`,
      `xfer ${measurement.transferKB}KB ws ${measurement.socketKB}KB`,
      memorySummary(measurement.memory)
    );

    return measurement;
  }
}

function fileIn(
  dir: string | null,
  name: string
): string | undefined {
  return dir === null ? undefined : path.join(dir, name);
}

function shuffled<T>(
  items: readonly T[]
): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }

  return copy;
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
