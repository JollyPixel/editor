// Import Node.js Dependencies
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

// Import Internal Dependencies
import type { OpenMeasurement } from "./OpenSample.ts";

export class ResultsFile {
  readonly file: string;
  readonly started = new Date().toISOString();
  readonly #setup: unknown;
  readonly #measurements: OpenMeasurement[] = [];

  static read(
    target: string
  ): OpenMeasurement[] {
    if (statSync(target).isDirectory()) {
      return readdirSync(target)
        .filter((file) => file.endsWith(".json"))
        .flatMap((file) => ResultsFile.read(path.join(target, file)));
    }

    return JSON.parse(readFileSync(target, "utf8")).measurements;
  }

  constructor(
    file: string,
    setup: unknown
  ) {
    this.file = path.resolve(file);
    this.#setup = setup;
    mkdirSync(path.dirname(this.file), { recursive: true });
  }

  add(
    measurement: OpenMeasurement
  ): void {
    this.#measurements.push(measurement);
    writeFileSync(this.file, JSON.stringify({
      started: this.started,
      setup: this.#setup,
      measurements: this.#measurements
    }, null, 1));
  }
}
