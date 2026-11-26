// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  SourceMapFile,
  type CallFrame
} from "@jolly-pixel/cdp";

// Import Internal Dependencies
import { STUDIO_SHELL_DIR } from "../../node/studioFiles.ts";
import { sourcePackage } from "./sourcePackage.ts";

export interface ServedEditors {
  distServing(url: string): string | null;
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

    const position = this.#loadSourceMap(callFrame.url)?.originalPosition(callFrame) ?? null;
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
      pkg: sourcePackage(position.source)
    };
  }

  #unmappedPackage(
    url: string
  ): string {
    if (url.startsWith("file:")) {
      return sourcePackage(url);
    }
    if (url.startsWith("node:")) {
      return "(node)";
    }

    return this.#editors.distServing(url) === null ? "(studio shell)" : "(editor, unmapped)";
  }

  #loadSourceMap(
    url: string
  ): SourceMapFile | null {
    if (!this.#maps.has(url)) {
      this.#maps.set(url, this.#findSourceMap(url));
    }

    return this.#maps.get(url) ?? null;
  }

  #findSourceMap(
    url: string
  ): SourceMapFile | null {
    const dist = this.#editors.distServing(url);
    const editorAsset = /\/editors\/[\w-]+\/(assets\/[^?]+)/.exec(url)?.[1];
    if (dist !== null && editorAsset !== undefined) {
      return SourceMapFile.load(path.join(dist, editorAsset));
    }

    const shellAsset = /^https?:\/\/[^/]+\/(assets\/[^?]+)/.exec(url)?.[1];

    return shellAsset === undefined ?
      null :
      SourceMapFile.load(path.join(STUDIO_SHELL_DIR, shellAsset));
  }
}

function shorten(
  source: string
): string {
  return source
    .replace(/^.*node_modules\//, "")
    .replace(/^.*packages\//, "");
}
