// Import Node.js Dependencies
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Import Third-party Dependencies
import {
  TraceMap,
  decodedMappings,
  originalPositionFor
} from "@jridgewell/trace-mapping";

export interface OriginalPosition {
  source: string;
  line: number;
  name: string | null;
  package: string;
}

export interface GeneratedSpan {
  package: string | null;
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

  static packageOf(
    source: string
  ): string {
    const normalized = source.replaceAll("\\", "/");
    const nodeModules = normalized.lastIndexOf("node_modules/");
    if (nodeModules !== -1) {
      const [scope, name] = normalized.slice(nodeModules + 13).split("/");

      return scope.startsWith("@") ? `${scope}/${name}` : scope;
    }

    const workspace = /packages\/(?:(editors|assets)\/)?([\w.-]+)\//.exec(normalized);
    if (workspace === null) {
      return "(this package)";
    }
    const [, group, name] = workspace;
    if (group === "editors") {
      return `@jolly-pixel/editor.${name}`;
    }
    if (group === "assets") {
      return `@jolly-pixel/asset.${name}`;
    }

    return `@jolly-pixel/${name}`;
  }

  constructor(
    map: TraceMap
  ) {
    this.#map = map;
  }

  originalPosition(
    line: number,
    column: number
  ): OriginalPosition | null {
    const position = originalPositionFor(this.#map, {
      line: line + 1,
      column
    });
    if (position.source === null) {
      return null;
    }

    return {
      source: position.source,
      line: position.line,
      name: position.name,
      package: SourceMapFile.packageOf(position.source)
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
          package: segment.length === 1 ?
            null :
            SourceMapFile.packageOf(resolvedSources[segment[1]]),
          bytes: Buffer.byteLength(line.slice(segment[0], segments[position + 1]?.[0]))
        };
      }
    }
  }
}
