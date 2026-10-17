// Import Node.js Dependencies
import path from "node:path";

// Import Internal Dependencies
import { SourceMapFile } from "./SourceMapFile.ts";

export interface ServedEditors {
  servingUrl(url: string): { dist: string; } | null;
}

export interface CallFrame {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}

export interface FrameLocation {
  label: string;
  file: string;
  pkg: string;
}

export class FrameLocator {
  readonly #editors: ServedEditors;
  readonly #maps = new Map<string, SourceMapFile | null>();

  constructor(
    editors: ServedEditors
  ) {
    this.#editors = editors;
  }

  locate(
    callFrame: CallFrame
  ): FrameLocation {
    if (callFrame.url === "") {
      const name = callFrame.functionName || "(native)";
      const group = name.startsWith("(") ? name : "(native)";

      return {
        label: name,
        file: group,
        pkg: group
      };
    }

    const map = callFrame.lineNumber >= 0 ? this.#loadSourceMap(callFrame.url) : null;
    const position = map?.originalPosition(callFrame.lineNumber, callFrame.columnNumber) ?? null;
    if (position === null) {
      const url = callFrame.url.replace(/^https?:\/\/[^/]+/, "");

      return {
        label: `${callFrame.functionName || "(anonymous)"} ${shorten(url)}:${callFrame.lineNumber + 1}`,
        file: shorten(url),
        pkg: this.#unmappedPackage(callFrame.url)
      };
    }

    const short = shorten(position.source);

    return {
      label: `${position.name ?? callFrame.functionName} ${short}:${position.line}`,
      file: short,
      pkg: position.package
    };
  }

  #unmappedPackage(
    url: string
  ): string {
    if (url.startsWith("file:")) {
      return SourceMapFile.parsePackage(url);
    }
    if (url.startsWith("node:")) {
      return "(node)";
    }

    return this.#editors.servingUrl(url) === null ? "(studio shell)" : "(editor, unmapped)";
  }

  #loadSourceMap(
    url: string
  ): SourceMapFile | null {
    if (!this.#maps.has(url)) {
      const editor = this.#editors.servingUrl(url);
      const asset = /\/editors\/[\w-]+\/(assets\/[^?]+)/.exec(url)?.[1];
      this.#maps.set(
        url,
        editor === null || asset === undefined ?
          null :
          SourceMapFile.load(path.join(editor.dist, asset))
      );
    }

    return this.#maps.get(url) ?? null;
  }
}

function shorten(
  source: string
): string {
  return source
    .replace(/^.*node_modules\//, "")
    .replace(/^.*packages\//, "");
}
