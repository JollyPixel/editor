// Import Internal Dependencies
import { Tally } from "./Tally.ts";
import type { Span } from "./Span.ts";
import type { TimeWindow } from "./TimeWindow.ts";

interface NestedSpan {
  span: Span;
  parent: Span | undefined;
}

export class TraceThread {
  readonly id: string;
  readonly name: string;
  readonly spans: readonly Span[];

  constructor(
    id: string,
    name: string,
    spans: Iterable<Span>
  ) {
    this.id = id;
    this.name = name;
    this.spans = [...spans].sort(
      (left, right) => left.start - right.start || right.duration - left.duration
    );
  }

  busy(): number {
    let busy = 0;
    for (const { span, parent } of this.#nesting()) {
      if (parent === undefined) {
        busy += span.duration;
      }
    }

    return busy;
  }

  selfTimes(): Tally {
    const selfTimes = new Tally();
    for (const { span, parent } of this.#nesting()) {
      if (parent !== undefined) {
        selfTimes.add(parent.name, -span.overlap(parent));
      }
      selfTimes.add(span.name, span.duration);
    }

    return selfTimes;
  }

  spansStartingWithin(
    window: TimeWindow
  ): Span[] {
    return this.spans.filter((span) => window.contains(span.start));
  }

  * gcPauses(): IterableIterator<Span> {
    let end = -Infinity;
    for (const span of this.spans) {
      if (span.start >= end && isForegroundGc(span)) {
        end = span.end;
        yield span;
      }
    }
  }

  * #nesting(): IterableIterator<NestedSpan> {
    const open: Span[] = [];
    for (const span of this.spans) {
      while (open.length > 0 && open[open.length - 1].end <= span.start) {
        open.pop();
      }
      yield {
        span,
        parent: open.at(-1)
      };
      open.push(span);
    }
  }
}

function isForegroundGc(
  span: Span
): boolean {
  const isGc = span.name === "MinorGC" ||
    span.name === "MajorGC" ||
    (span.category.includes("v8.gc") && span.name.startsWith("V8.GC_"));

  return isGc && !span.name.includes("BACKGROUND");
}
