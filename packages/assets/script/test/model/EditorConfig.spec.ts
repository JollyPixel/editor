// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { resolveEditorConfig } from "#src/model/EditorConfig.ts";
import type { LineEnding } from "#src/model/LineEnding.ts";
import type { TextFormatJSON } from "#src/model/TextFormat.ts";

interface ResolvedSettings {
  format: TextFormatJSON;
  lineEnding: LineEnding | null;
}

type Expectation = readonly [path: string, settings: ResolvedSettings];

// CONSTANTS
const kEncoder = new TextEncoder();
const kDefault = format("space", 2, 2);

describe("resolveEditorConfig", () => {
  const cases: Array<[string, Record<string, string>, Expectation[]]> = [
    [
      "keeps the defaults without an .editorconfig",
      {},
      [["scripts/player.ts", kDefault]]
    ],
    [
      "applies [*] to files at any depth",
      { ".editorconfig": "[*]\nindent_style = tab\nindent_size = 4" },
      [["scripts/ai/player.ts", format("tab", 4, 4)]]
    ],
    [
      "matches a section without a slash at any depth, and one with a slash from its file",
      { ".editorconfig": "[*.ts]\nindent_size = 4\n[scripts/*.js]\nindent_size = 8" },
      [
        ["deep/nested/player.ts", format("space", 4, 4)],
        ["README.md", kDefault],
        ["scripts/player.js", format("space", 8, 8)],
        ["lib/scripts/player.js", kDefault]
      ]
    ],
    [
      "matches a section of a nested file from that file's folder",
      { "scripts/.editorconfig": "[/player.ts]\nindent_size = 8" },
      [
        ["scripts/player.ts", format("space", 8, 8)],
        ["scripts/ai/player.ts", kDefault]
      ]
    ],
    [
      "lets a closer file override a farther one",
      {
        ".editorconfig": "[*]\nindent_size = 2\nend_of_line = crlf",
        "scripts/.editorconfig": "[*]\nindent_size = 4"
      },
      [["scripts/player.ts", format("space", 4, 4, "\r\n")]]
    ],
    [
      "stops looking above a root = true file",
      {
        ".editorconfig": "[*]\nend_of_line = crlf",
        "scripts/.editorconfig": "root = true\n[*]\nindent_size = 4"
      },
      [["scripts/player.ts", format("space", 4, 4)]]
    ],
    [
      "drops a property set to unset",
      { ".editorconfig": "[*]\nindent_size = 4\n[*.ts]\nindent_size = unset" },
      [["player.ts", kDefault]]
    ],
    [
      "takes tab_width for indent_size = tab",
      { ".editorconfig": "[*]\nindent_style = tab\nindent_size = tab\ntab_width = 8" },
      [["player.ts", format("tab", 8, 8)]]
    ],
    [
      "reads keys and values in any case and skips comments",
      { ".editorconfig": "# tabs\n; everywhere\n[*]\nIndent_Style = Tab\nEND_OF_LINE = CRLF" },
      [["player.ts", format("tab", 2, 2, "\r\n")]]
    ],
    [
      "ignores widths outside 1 to 16",
      { ".editorconfig": "[*]\nindent_size = 0\ntab_width = 99" },
      [["player.ts", kDefault]]
    ],
    [
      "expands numeric ranges and negated brackets",
      { ".editorconfig": "[level{1..12}.ts]\nindent_size = 4\n[[!l]*.ts]\nindent_size = 8" },
      [
        ["level12.ts", format("space", 4, 4)],
        ["level13.ts", kDefault],
        ["main.ts", format("space", 8, 8)]
      ]
    ]
  ];

  for (const [title, files, expectations] of cases) {
    test(title, async() => {
      for (const [path, expected] of expectations) {
        assert.deepEqual(await resolve(path, files), expected, path);
      }
    });
  }
});

function format(
  indentStyle: TextFormatJSON["indentStyle"],
  indentSize: number,
  tabWidth: number,
  lineEnding: LineEnding | null = null
): ResolvedSettings {
  return {
    format: {
      indentStyle,
      indentSize,
      tabWidth
    },
    lineEnding
  };
}

async function resolve(
  path: string,
  files: Record<string, string>
): Promise<ResolvedSettings> {
  const settings = await resolveEditorConfig(
    path,
    (filePath) => Promise.resolve(
      Object.hasOwn(files, filePath) ? kEncoder.encode(files[filePath]) : null
    )
  );

  return {
    format: settings.format.toJSON(),
    lineEnding: settings.lineEnding
  };
}
