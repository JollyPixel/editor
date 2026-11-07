// Import Node.js Dependencies
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Import Third-party Dependencies
import {
  TraceMap,
  decodedMappings,
  originalPositionFor
} from "@jridgewell/trace-mapping";

// Import Internal Dependencies
import type { CallFrame } from "./CallFrame.ts";

export interface OriginalPosition {
  source: string;
  line: number;
  name: string | null;
}

export interface GeneratedSpan {
  source: string | null;
  bytes: number;
}

export class SourceMapFile {
  readonly #map: TraceMap;

  static load(
    file: string
  ): SourceMapFile | null {
    const mapFile = `${file}.map`;
    if (!existsSync(mapFile)) {
      return null;
    }

    return new SourceMapFile(
      new TraceMap(readFileSync(mapFile, "utf8"), pathToFileURL(mapFile).href)
    );
  }

  constructor(
    map: TraceMap
  ) {
    this.#map = map;
  }

  originalPosition(
    callFrame: CallFrame
  ): OriginalPosition | null {
    if (callFrame.lineNumber < 0) {
      return null;
    }

    const position = originalPositionFor(this.#map, {
      line: callFrame.lineNumber + 1,
      column: callFrame.columnNumber
    });
    if (position.source === null) {
      return null;
    }

    return {
      source: position.source,
      line: position.line,
      name: position.name
    };
  }

  * generatedSpans(
    code: string
  ): IterableIterator<GeneratedSpan> {
    const lines = code.split("\n");
    const { resolvedSources } = this.#map;
    for (const [index, segments] of decodedMappings(this.#map).entries()) {
      const line = lines[index] ?? "";
      for (const [position, segment] of segments.entries()) {
        yield {
          source: segment.length === 1 ? null : resolvedSources[segment[1]],
          bytes: Buffer.byteLength(line.slice(segment[0], segments[position + 1]?.[0]))
        };
      }
    }
  }
}
