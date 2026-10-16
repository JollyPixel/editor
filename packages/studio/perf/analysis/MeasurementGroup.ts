// Import Internal Dependencies
import type {
  OpenMeasurement,
  Phase
} from "../harness/OpenSample.ts";
import type { StudioMode } from "../harness/StudioPage.ts";

export type MeasurementPick = (measurement: OpenMeasurement) => number | undefined;

export class MeasurementGroup {
  readonly editor: string;
  readonly mode: StudioMode;
  readonly phase: Phase;
  readonly label: string;
  readonly items: OpenMeasurement[] = [];

  static groupAll(
    measurements: Iterable<OpenMeasurement>
  ): MeasurementGroup[] {
    const groups = new Map<string, MeasurementGroup>();
    for (const measurement of measurements) {
      const key = [
        measurement.editor,
        measurement.mode,
        measurement.phase,
        measurement.label
      ].join("\0");
      let group = groups.get(key);
      if (group === undefined) {
        group = new MeasurementGroup(measurement);
        groups.set(key, group);
      }
      group.items.push(measurement);
    }

    return [...groups.values()];
  }

  constructor(
    sample: Pick<OpenMeasurement, "editor" | "mode" | "phase" | "label">
  ) {
    this.editor = sample.editor;
    this.mode = sample.mode;
    this.phase = sample.phase;
    this.label = sample.label;
  }

  sharesCellWith(
    other: MeasurementGroup
  ): boolean {
    return this.editor === other.editor &&
      this.mode === other.mode &&
      this.phase === other.phase;
  }

  median(
    pick: MeasurementPick
  ): number {
    const sorted = this.#sorted(pick);
    const middle = sorted.length >> 1;

    return Math.round(
      sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    );
  }

  percentile(
    pick: MeasurementPick,
    rank: number
  ): number {
    const sorted = this.#sorted(pick);

    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)];
  }

  #sorted(
    pick: MeasurementPick
  ): number[] {
    return this.items
      .map(pick)
      .filter((value) => value !== undefined)
      .sort((left, right) => left - right);
  }
}
