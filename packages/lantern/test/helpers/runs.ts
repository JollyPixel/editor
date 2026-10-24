// Import Internal Dependencies
import type { Tour } from "#src/index.ts";
import { TourRun } from "#src/tour/TourRun.ts";
import { tour } from "./tours.ts";

export interface Recorder {
  run: TourRun;
  log: string[];
  warnings: string[];
}

export function record(
  run: TourRun,
  log: string[] = []
): Omit<Recorder, "warnings"> {
  run.on("step", (shown) => log.push(`step ${shown.id}`));
  run.on("end", (outcome) => log.push(`end ${outcome}`));

  return {
    run,
    log
  };
}

export function start(
  steps: Tour = tour(),
  at?: string
): Recorder {
  const warnings: string[] = [];
  const recorder = record(new TourRun(steps, {
    at,
    warn: (message) => warnings.push(message)
  }));

  return {
    ...recorder,
    warnings
  };
}
