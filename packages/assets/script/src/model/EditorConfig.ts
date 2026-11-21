// Import Third-party Dependencies
import picomatch from "picomatch";

// Import Internal Dependencies
import type { LineEnding } from "./LineEnding.ts";
import {
  MAX_INDENT_WIDTH,
  TextFormat,
  type IndentStyle
} from "./TextFormat.ts";

export type ProjectFileReader = (
  path: string
) => Promise<Uint8Array | null>;

export interface EditorConfigSettings {
  readonly format: TextFormat;
  readonly lineEnding: LineEnding | null;
}

interface EditorConfigSection {
  readonly matches: (path: string) => boolean;
  readonly properties: Array<[string, string]>;
}

// CONSTANTS
const kFileName = ".editorconfig";
const kDecoder = new TextDecoder();
const kLineBreak = /\r?\n/;
const kComment = /^[#;]/;
const kBrackets = /\[[^\]]*\]/g;
const kNegatedBrackets = /\[!/g;
const kLeadingSlash = /^\//;
const kWidth = /^\d+$/;
const kMaxRangeLength = 1_000;
const kNoMatch = "(?!)";
const kLineEndings = new Map<string, LineEnding>([
  ["lf", "\n"],
  ["crlf", "\r\n"]
]);

export async function resolveEditorConfig(
  path: string,
  read: ProjectFileReader
): Promise<EditorConfigSettings> {
  const found: Array<[string, EditorConfig]> = [];
  for (const directory of ancestors(path)) {
    const content = await read(
      directory === "" ? kFileName : `${directory}/${kFileName}`
    );
    if (content === null) {
      continue;
    }

    const config = new EditorConfig(kDecoder.decode(content));
    found.push([directory, config]);
    if (config.root) {
      break;
    }
  }

  const properties = new Map<string, string>();
  for (const [directory, config] of found.toReversed()) {
    config.applyTo(
      directory === "" ? path : path.slice(directory.length + 1),
      properties
    );
  }

  return editorConfigSettings(properties);
}

class EditorConfig {
  readonly root: boolean;

  #sections: EditorConfigSection[] = [];

  constructor(
    source: string
  ) {
    let root = false;
    let section: EditorConfigSection | null = null;
    for (const raw of source.split(kLineBreak)) {
      const line = raw.trim();
      if (line === "" || kComment.test(line)) {
        continue;
      }
      if (line.startsWith("[") && line.endsWith("]")) {
        section = {
          matches: sectionMatcher(line.slice(1, -1)),
          properties: []
        };
        this.#sections.push(section);
        continue;
      }

      const separator = line.indexOf("=");
      if (separator === -1) {
        continue;
      }
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim().toLowerCase();
      if (section === null) {
        root ||= key === "root" && value === "true";
      }
      else if (key !== "") {
        section.properties.push([key, value]);
      }
    }
    this.root = root;
  }

  applyTo(
    path: string,
    properties: Map<string, string>
  ): void {
    for (const section of this.#sections) {
      if (section.matches(path)) {
        for (const [key, value] of section.properties) {
          properties.set(key, value);
        }
      }
    }
  }
}

function editorConfigSettings(
  properties: ReadonlyMap<string, string>
): EditorConfigSettings {
  const style = properties.get("indent_style");
  const indentStyle = isIndentStyle(style) ? style : undefined;
  const size = properties.get("indent_size");
  const tabWidth = width(properties.get("tab_width")) ?? width(size);
  const indentSize = width(size) ??
    (size === "tab" || indentStyle === "tab" ? tabWidth : undefined);

  return {
    format: new TextFormat({
      indentStyle,
      indentSize,
      tabWidth
    }),
    lineEnding: kLineEndings.get(properties.get("end_of_line") ?? "") ?? null
  };
}

function isIndentStyle(
  value: string | undefined
): value is IndentStyle {
  return value === "tab" || value === "space";
}

function width(
  value: string | undefined
): number | undefined {
  if (value === undefined || !kWidth.test(value)) {
    return undefined;
  }

  const parsed = Number(value);

  return parsed >= 1 && parsed <= MAX_INDENT_WIDTH ? parsed : undefined;
}

function ancestors(
  path: string
): string[] {
  const folders = path.split("/").slice(0, -1);

  return Array.from(
    { length: folders.length + 1 },
    (_, index) => folders.slice(0, folders.length - index).join("/")
  );
}

function sectionMatcher(
  glob: string
): EditorConfigSection["matches"] {
  const anchored = glob.replace(kBrackets, "").includes("/");
  const pattern = glob.replace(kNegatedBrackets, "[^");

  return picomatch(
    anchored ? pattern.replace(kLeadingSlash, "") : `**/${pattern}`,
    {
      dot: true,
      windows: false,
      expandRange
    }
  );
}

function expandRange(
  from: string,
  to: string
): string {
  const start = Number(from);
  const end = Number(to);
  const low = Math.min(start, end);
  const length = Math.max(start, end) - low + 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || length > kMaxRangeLength) {
    return kNoMatch;
  }

  const numbers = Array.from({ length }, (_, index) => String(low + index));

  return `(?:${numbers.join("|")})`;
}
