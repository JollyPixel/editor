// Import Node.js Dependencies
import { readFileSync } from "node:fs";

export interface TraceEvent {
  name: string;
  cat?: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: {
    name?: string;
    data?: {
      type?: string;
      functionName?: string;
      url?: string;
    };
  };
}

export interface Span extends TraceEvent {
  dur: number;
}

export interface GcPauses {
  count: number;
  ms: number;
}

export interface GcSummary {
  minor: GcPauses;
  major: GcPauses;
}

// CONSTANTS
export const GC_CATEGORIES = [
  "v8",
  "disabled-by-default-v8.gc"
];
const kRendererMain = "CrRendererMain";
const kMinorGc = /MinorGC|SCAVENGER|MINOR_M/;

export class Trace {
  readonly events: TraceEvent[];
  readonly spans: Span[];
  readonly #threadNames = new Map<string, string>();

  static read(
    file: string
  ): Trace {
    return Trace.parse(readFileSync(file, "utf8"));
  }

  static parse(
    json: string
  ): Trace {
    const raw = JSON.parse(json);

    return new Trace(Array.isArray(raw) ? raw : raw.traceEvents);
  }

  static threadKey(
    event: TraceEvent
  ): string {
    return `${event.pid}:${event.tid}`;
  }

  constructor(
    events: TraceEvent[]
  ) {
    this.events = events;
    this.spans = events.filter(
      (event): event is Span => event.ph === "X" && event.dur !== undefined
    );
    for (const event of events) {
      if (event.ph === "M" && event.name === "thread_name") {
        this.#threadNames.set(Trace.threadKey(event), event.args?.name ?? "?");
      }
    }
  }

  threadName(
    event: TraceEvent
  ): string {
    return this.#threadNames.get(Trace.threadKey(event)) ?? "?";
  }

  garbageCollections(
    from = -Infinity,
    until = Infinity
  ): GcSummary {
    const summary: GcSummary = {
      minor: { count: 0, ms: 0 },
      major: { count: 0, ms: 0 }
    };
    const pauses = this.spans
      .filter((span) => this.#isMainThreadGc(span) && span.ts >= from && span.ts <= until)
      .sort((left, right) => left.ts - right.ts || right.dur - left.dur);

    const ends = new Map<string, number>();
    for (const span of pauses) {
      const thread = Trace.threadKey(span);
      if (span.ts < (ends.get(thread) ?? -Infinity)) {
        continue;
      }
      ends.set(thread, span.ts + span.dur);
      const pause = kMinorGc.test(span.name) ? summary.minor : summary.major;
      pause.count++;
      pause.ms += span.dur / 1000;
    }
    summary.minor.ms = Math.round(summary.minor.ms);
    summary.major.ms = Math.round(summary.major.ms);

    return summary;
  }

  #isMainThreadGc(
    span: Span
  ): boolean {
    const isGc = span.name === "MinorGC" ||
      span.name === "MajorGC" ||
      (span.cat?.includes("v8.gc") === true && span.name.startsWith("V8.GC_"));

    return isGc &&
      !span.name.includes("BACKGROUND") &&
      this.threadName(span) === kRendererMain;
  }
}
