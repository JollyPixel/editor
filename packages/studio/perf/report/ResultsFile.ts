// Import Node.js Dependencies
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
const kResultKinds = ["open", "steady"] as const;
const kEnvelopeSchema = z.object({
  kind: z.enum(kResultKinds),
  measurements: z.array(z.unknown())
});

export type ResultKind = typeof kResultKinds[number];

export class ResultsFile<TMeasurement> implements Iterable<TMeasurement> {
  readonly file: string;
  readonly kind: ResultKind;
  readonly started = new Date().toISOString();
  readonly #setup: unknown;
  readonly #measurements: TMeasurement[] = [];

  static read<TMeasurement>(
    target: string,
    kind: ResultKind
  ): TMeasurement[] {
    if (statSync(target).isDirectory()) {
      return readdirSync(target)
        .filter((file) => file.endsWith(".json"))
        .map((file) => readEnvelope(path.join(target, file)))
        .filter((envelope) => envelope.kind === kind)
        .flatMap((envelope) => envelope.measurements as TMeasurement[]);
    }

    const envelope = readEnvelope(target);
    if (envelope.kind !== kind) {
      throw new TypeError(`"${target}" holds ${envelope.kind} results, not ${kind} results`);
    }

    return envelope.measurements as TMeasurement[];
  }

  constructor(
    file: string,
    kind: ResultKind,
    setup: unknown
  ) {
    this.file = path.resolve(file);
    this.kind = kind;
    this.#setup = setup;
    mkdirSync(
      path.dirname(this.file),
      { recursive: true }
    );
  }

  add(
    measurement: TMeasurement
  ): void {
    this.#measurements.push(measurement);
    writeFileSync(this.file, JSON.stringify({
      kind: this.kind,
      started: this.started,
      setup: this.#setup,
      measurements: this.#measurements
    }, null, 1));
  }

  [Symbol.iterator](): IterableIterator<TMeasurement> {
    return this.#measurements.values();
  }
}

function readEnvelope(
  file: string
): z.infer<typeof kEnvelopeSchema> {
  const envelope = kEnvelopeSchema.safeParse(
    JSON.parse(readFileSync(file, "utf8"))
  );
  if (!envelope.success) {
    throw new TypeError(`"${file}" is not a results file:\n${z.prettifyError(envelope.error)}`);
  }

  return envelope.data;
}
