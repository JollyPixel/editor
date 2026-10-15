// Import Node.js Dependencies
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// CONSTANTS
const kBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const kVlqContinuation = 32;
const kVlqMask = 31;

export interface MappedSegment {
  column: number;
  source: string | null;
  line: number;
  name: string | null;
}

export interface OriginalPosition {
  source: string;
  line: number;
  name: string | null;
}

interface RawSourceMap {
  sources: string[];
  names?: string[];
  mappings: string;
}

export class SourceMap {
  readonly lines: MappedSegment[][];

  static load(
    file: string
  ): SourceMap | null {
    const mapFile = `${file}.map`;
    if (!existsSync(mapFile)) {
      return null;
    }

    const raw: RawSourceMap = JSON.parse(readFileSync(mapFile, "utf8"));

    return new SourceMap({
      ...raw,
      sources: raw.sources.map((source) => path.resolve(path.dirname(mapFile), source))
    });
  }

  constructor(
    raw: RawSourceMap
  ) {
    this.lines = decodeMappings(raw);
  }

  originalPosition(
    line: number,
    column: number
  ): OriginalPosition | null {
    const segments = this.lines[line] ?? [];
    let found: MappedSegment | null = null;
    for (const segment of segments) {
      if (segment.column > column) {
        break;
      }
      found = segment;
    }
    if (found === null || found.source === null) {
      return null;
    }

    return {
      source: found.source,
      line: found.line + 1,
      name: found.name
    };
  }
}

export function packageOf(
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

function decodeMappings(
  raw: RawSourceMap
): MappedSegment[][] {
  const names = raw.names ?? [];
  const lines: MappedSegment[][] = [];
  let sourceIndex = 0;
  let sourceLine = 0;
  let nameIndex = 0;

  for (const line of raw.mappings.split(";")) {
    const segments: MappedSegment[] = [];
    let column = 0;
    for (const encoded of line.split(",")) {
      if (encoded === "") {
        continue;
      }
      const fields = decodeVlq(encoded);
      column += fields[0];
      if (fields.length === 1) {
        segments.push({
          column,
          source: null,
          line: 0,
          name: null
        });
        continue;
      }
      sourceIndex += fields[1];
      sourceLine += fields[2];
      if (fields.length > 4) {
        nameIndex += fields[4];
      }
      segments.push({
        column,
        source: raw.sources[sourceIndex] ?? null,
        line: sourceLine,
        name: fields.length > 4 ? names[nameIndex] ?? null : null
      });
    }
    lines.push(segments);
  }

  return lines;
}

function decodeVlq(
  encoded: string
): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  for (const char of encoded) {
    const digit = kBase64.indexOf(char);
    value += (digit & kVlqMask) << shift;
    if (digit & kVlqContinuation) {
      shift += 5;
      continue;
    }
    values.push(value & 1 ? -(value >>> 1) : value >>> 1);
    value = 0;
    shift = 0;
  }

  return values;
}
