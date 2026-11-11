// Import Third-party Dependencies
import {
  FRAME_PACING_THRESHOLDS,
  startFramePacing,
  startInputLatency,
  stopFramePacing,
  stopInputLatency
} from "@jolly-pixel/cdp";
import type { Frame } from "@playwright/test";

// Import Internal Dependencies
import { alternatingRounds } from "../common/alternatingRounds.ts";
import {
  DEFAULT_SETTLE_MS,
  fileIn
} from "../common/flags.ts";
import { BenchBrowser } from "../studio/BenchBrowser.ts";
import type {
  BenchEditor,
  BenchEditors
} from "../studio/BenchEditors.ts";
import { readProbe } from "../studio/pageProbe.ts";
import type { StudioMode } from "../studio/StudioPage.ts";
import { StudioSession } from "../studio/StudioSession.ts";
import { CodePane } from "./CodePane.ts";
import type {
  EditPlan,
  EditVariant
} from "./Plan.ts";
import {
  EditSample,
  type EditMeasurement
} from "./Sample.ts";
import {
  SCENARIO_PLANS,
  type EditScenario
} from "./Scenario.ts";

export interface EditRunSettings {
  keys: number;
  cpuThrottle: number;
  profileDir: string | null;
  memoryDir: string | null;
}

interface EditCell {
  round: number;
  variant: EditVariant;
  mode: StudioMode;
  editor: BenchEditor;
}

// CONSTANTS
const kCaretFraction = 0.5;
const kBeforeScenarioMs = 500;
const kAfterScenarioMs = 1_000;
const kRestoreMs = 2_000;

export class EditRun {
  readonly #plan: EditPlan;
  readonly #editors: readonly BenchEditor[];
  readonly #settings: EditRunSettings;

  constructor(
    plan: EditPlan,
    editors: BenchEditors,
    settings: EditRunSettings
  ) {
    this.#plan = plan;
    this.#editors = editors.select(plan.editors);
    this.#settings = settings;
  }

  async* measure(
    rounds: number
  ): AsyncGenerator<EditMeasurement> {
    for (const { round, item: variant } of alternatingRounds(this.#plan.variants, rounds)) {
      console.log(`round ${round} ${variant.label}`);
      for (const mode of this.#plan.modes) {
        for (const editor of this.#editors) {
          const bench = await BenchBrowser.launch({
            headless: false
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
    cell: EditCell
  ): AsyncGenerator<EditMeasurement> {
    const { variant, mode, editor } = cell;
    const session = await StudioSession.start(bench, {
      base: variant.base,
      mode,
      storage: variant.storage,
      probe: true,
      cpuThrottle: this.#settings.cpuThrottle
    });
    const { studio } = session;
    await studio.waitUntilOpenable(editor);
    const frame = await studio.openEditor(editor);
    const pane = new CodePane(frame);
    await studio.page.waitForTimeout(DEFAULT_SETTLE_MS);
    const original = await pane.text();

    try {
      for (const scenario of this.#plan.scenarios) {
        yield await this.#measureScenario(session, frame, pane, cell, scenario);
      }
    }
    finally {
      if (mode === "online") {
        await this.#restore(session, pane, original);
      }
      await session.close();
    }
  }

  async #measureScenario(
    session: StudioSession,
    frame: Frame,
    pane: CodePane,
    { round, variant, mode, editor }: EditCell,
    scenario: EditScenario
  ): Promise<EditMeasurement> {
    const { page } = session.studio;
    const { keys, profileDir, memoryDir } = this.#settings;
    const plan = SCENARIO_PLANS[scenario];
    const fileStem = `${variant.label}-${mode}-${editor.name}-${scenario}-${round}`;
    const { textLength } = await pane.placeCaretAtLineEnd(kCaretFraction);
    await page.waitForTimeout(kBeforeScenarioMs);

    const { result, recording } = await session.record(
      {
        cpuProfile: fileIn(profileDir, `${fileStem}.cpuprofile`),
        heapProfile: fileIn(memoryDir, `${fileStem}.heapprofile`)
      },
      async() => {
        await frame.evaluate(startFramePacing, FRAME_PACING_THRESHOLDS);
        await frame.evaluate(startInputLatency, plan.events);
        await plan.play({
          page,
          pane,
          keys
        });
        await page.waitForTimeout(kAfterScenarioMs);

        return {
          latency: await frame.evaluate(stopInputLatency),
          pacing: await frame.evaluate(stopFramePacing)
        };
      }
    );

    const sample = new EditSample({
      recording,
      latency: result.latency,
      pacing: result.pacing,
      probes: [
        await frame.evaluate(readProbe),
        await page.evaluate(readProbe)
      ]
    });
    const measurement = sample.toMeasurement({
      label: variant.label,
      run: round,
      mode,
      editor: editor.name,
      scenario,
      textKB: Math.round(textLength / 102.4) / 10
    });
    console.log(
      `${round} ${variant.label} ${mode.padEnd(7)} ${editor.name.padEnd(11)} ${scenario.padEnd(6)}`,
      `p50 ${measurement.latencyP50} p95 ${measurement.latencyP95} max ${measurement.latencyMax}`,
      `task ${measurement.taskMsPerInput}ms/input long ${measurement.longFramesMs}ms`,
      `sent ${measurement.socketSentKB}KB`
    );

    return measurement;
  }

  async #restore(
    session: StudioSession,
    pane: CodePane,
    original: string
  ): Promise<void> {
    const { page } = session.studio;
    await pane.placeCaretAtLineEnd(0);
    await page.keyboard.press("Control+a");
    await pane.paste(original);
    await page.waitForTimeout(kRestoreMs);
  }
}
