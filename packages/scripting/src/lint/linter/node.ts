// Import Node.js Dependencies
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import type { ScriptDiagnostic } from "../../diagnostics/ScriptDiagnostic.schema.ts";

// CONSTANTS
const kOxlint = fileURLToPath(
  new URL("bin/oxlint", import.meta.resolve("oxlint/package.json"))
);
const kFileName = "script.ts";
const kReportSchema = z.object({
  diagnostics: z.array(z.object({
    message: z.string(),
    code: z.optional(z.string()),
    severity: z.string(),
    labels: z.array(z.object({
      span: z.object({
        offset: z.int(),
        length: z.int()
      })
    }))
  }))
});

export async function lintScript(
  text: string
): Promise<ScriptDiagnostic[] | null> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jolly-pixel-lint-"));
  const file = path.join(dir, kFileName);

  try {
    await fs.writeFile(file, text);
    const report = kReportSchema.parse(JSON.parse(await oxlint(dir)));
    const bytes = Buffer.from(text);

    return report.diagnostics.map((diagnostic) => {
      const span = diagnostic.labels[0]?.span ?? { offset: 0, length: 0 };
      const start = utf16Offset(bytes, span.offset);

      return {
        start,
        length: utf16Offset(bytes, span.offset + span.length) - start,
        severity: diagnostic.severity === "error" ? "error" : "warning",
        message: diagnostic.message,
        code: diagnostic.code ?? null
      };
    });
  }
  finally {
    await fs.rm(file, { force: true });
    await fs.rmdir(dir);
  }
}

function oxlint(
  dir: string
): Promise<string> {
  const args = [
    kOxlint,
    "--allow",
    "all",
    "--warn",
    "correctness",
    "--disable-nested-config",
    "--format",
    "json",
    kFileName
  ];

  return new Promise((resolve, reject) => {
    execFile(process.execPath, args, { cwd: dir }, (error, stdout) => {
      if (stdout.trimStart().startsWith("{")) {
        resolve(stdout);
      }
      else {
        reject(error ?? new Error(`oxlint printed no report: ${stdout}`));
      }
    });
  });
}

function utf16Offset(
  bytes: Buffer,
  byteOffset: number
): number {
  return bytes.toString("utf-8", 0, byteOffset).length;
}
