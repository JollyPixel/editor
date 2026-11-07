// Import Node.js Dependencies
import { readFileSync } from "node:fs";

// Import Internal Dependencies
import { Span } from "./Span.ts";
import { TraceThread } from "./TraceThread.ts";

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
const kUnnamedThread = "?";

export class Trace {
  readonly events: readonly TraceEvent[];
  readonly #names = new Map<string, string>();
  readonly #threads = new Map<string, TraceThread>();

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

  constructor(
    events: TraceEvent[]
  ) {
    this.events = events;
    const spans = new Map<string, Span[]>();
    for (const event of events) {
      if (event.ph === "M" && event.name === "thread_name") {
        this.#names.set(threadId(event), event.args?.name ?? kUnnamedThread);
      }
      else if (event.ph === "X" && event.dur !== undefined) {
        const id = threadId(event);
        const list = spans.get(id) ?? [];
        list.push(new Span(event.name, event.cat ?? "", event.ts, event.dur));
        spans.set(id, list);
      }
    }
    for (const [id, list] of spans) {
      this.#threads.set(id, new TraceThread(id, this.#threadName(id), list));
    }
  }

  threads(): IterableIterator<TraceThread> {
    return this.#threads.values();
  }

  threadRunning(
    event: TraceEvent
  ): TraceThread {
    const id = threadId(event);

    return this.#threads.get(id) ?? new TraceThread(id, this.#threadName(id), []);
  }

  garbageCollections(): GcSummary {
    let minorUs = 0;
    let majorUs = 0;
    let minorCount = 0;
    let majorCount = 0;
    for (const thread of this.#threads.values()) {
      if (thread.name !== kRendererMain) {
        continue;
      }
      for (const pause of thread.gcPauses()) {
        if (kMinorGc.test(pause.name)) {
          minorCount++;
          minorUs += pause.duration;
        }
        else {
          majorCount++;
          majorUs += pause.duration;
        }
      }
    }

    return {
      minor: {
        count: minorCount,
        ms: Math.round(minorUs / 1000)
      },
      major: {
        count: majorCount,
        ms: Math.round(majorUs / 1000)
      }
    };
  }

  #threadName(
    id: string
  ): string {
    return this.#names.get(id) ?? kUnnamedThread;
  }
}

function threadId(
  event: TraceEvent
): string {
  return `${event.pid}:${event.tid}`;
}
