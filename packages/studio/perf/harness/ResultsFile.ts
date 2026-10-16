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

// Import Internal Dependencies
import type { OpenMeasurement } from "./OpenSample.ts";
import type { SteadyMeasurement } from "./SteadySample.ts";

export interface ResultKinds {
  open: OpenMeasurement;
  steady: SteadyMeasurement;
}

export type ResultKind = keyof ResultKinds;

// CONSTANTS
const kResultKinds = ["open", "steady"] as const satisfies readonly ResultKind[];
const kEnvelopeSchema = z.object({
  kind: z.enum(kResultKinds),
  measurements: z.array(z.unknown())
});

export class ResultsFile<TKind extends ResultKind> implements Iterable<ResultKinds[TKind]> {
  readonly file: string;
  readonly kind: TKind;
  readonly started = new Date().toISOString();
  readonly #setup: unknown;
  readonly #measurements: ResultKinds[TKind][] = [];

  static read<TKind extends ResultKind>(
    target: string,
    kind: TKind
  ): ResultKinds[TKind][] {
    if (statSync(target).isDirectory()) {
      return readdirSync(target)
        .filter((file) => file.endsWith(".json"))
        .map((file) => readEnvelope(path.join(target, file)))
        .filter((envelope) => envelope.kind === kind)
        .flatMap((envelope) => envelope.measurements as ResultKinds[TKind][]);
    }

    const envelope = readEnvelope(target);
    if (envelope.kind !== kind) {
      throw new TypeError(`"${target}" holds ${envelope.kind} results, not ${kind} results`);
    }

    return envelope.measurements as ResultKinds[TKind][];
  }

  constructor(
    file: string,
    kind: TKind,
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
    measurement: ResultKinds[TKind]
  ): void {
    this.#measurements.push(measurement);
    writeFileSync(this.file, JSON.stringify({
      kind: this.kind,
      started: this.started,
      setup: this.#setup,
      measurements: this.#measurements
    }, null, 1));
  }

  [Symbol.iterator](): IterableIterator<ResultKinds[TKind]> {
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
